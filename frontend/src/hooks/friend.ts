import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendService } from "../services/friend";
import { useAppToast } from "./ui";
import { useUser } from "./auth";
import { FRIEND_REQUEST_STATUS } from "../utils/friend";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SocketContext } from "../lib/websocket";

function useGetFriends(
    status: (typeof FRIEND_REQUEST_STATUS)[keyof typeof FRIEND_REQUEST_STATUS],
    type: "from" | "to"
) {
    const { user, isAuthenticated } = useUser();

    const query = useQuery({
        queryKey: [isAuthenticated, user?.id, "friends", status, type],
        enabled: isAuthenticated,
        queryFn: async () => {
            const [ok, err] = await friendService.getFriendRequests(
                status,
                type
            );

            if (err || !ok) {
                return [] as unknown as NonNullable<typeof ok>["friends"];
            }

            return ok.friends;
        },
        staleTime: 1000 * 60 * 10, // 10mins
    });

    return query;
}

export function useFriendManager() {
    const { infoToast } = useAppToast();
    const { user, isAuthenticated, pushToLogin } = useUser();
    const queryClient = useQueryClient();

    // "from" here doesn't matter as its going to get friend
    // whose request the user has accepted or vice versa
    const acceptedFriendsQuery = useGetFriends(
        FRIEND_REQUEST_STATUS.ACCEPTED,
        "from"
    );

    const friends = useMemo(
        function transformAcceptedFriends() {
            return (
                acceptedFriendsQuery.data?.map((friend) => {
                    return {
                        ...friend,
                        friend:
                            user!.id === friend.toUser.id
                                ? friend.fromUser
                                : friend.toUser,
                    };
                }) ?? []
            );
        },
        [acceptedFriendsQuery.data]
    );

    const receivedRequestsQuery = useGetFriends(
        FRIEND_REQUEST_STATUS.PENDING,
        "to"
    );

    const sentRequestsQuery = useGetFriends(
        FRIEND_REQUEST_STATUS.PENDING,
        "from"
    );

    /** Logged in user's requests that the other users have rejected */
    const rejectedRequestsQuery = useGetFriends(
        FRIEND_REQUEST_STATUS.REJECTED,
        "from"
    );

    /** Requests that the logged in user has rejected */
    const blockedRequestsQuery = useGetFriends(
        FRIEND_REQUEST_STATUS.REJECTED,
        "to"
    );

    const sendRequestMutation = useMutation({
        mutationFn: async (args: { userId: string }) => {
            if (!isAuthenticated) {
                pushToLogin();
            } else {
                const msg = await friendService.sendFriendRequest(args.userId);
                infoToast(msg);
            }
        },
    });

    const acceptFriendRequestMutation = useMutation({
        mutationFn: async (requestId: string) => {
            const msg = await friendService.updateFriendRequestStatus(
                FRIEND_REQUEST_STATUS.ACCEPTED,
                requestId
            );

            infoToast(msg);

            if (msg.toLowerCase().includes("updated")) {
                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: [
                            isAuthenticated,
                            user?.id,
                            "friends",
                            FRIEND_REQUEST_STATUS.ACCEPTED,
                            "from",
                        ],
                    }),

                    queryClient.invalidateQueries({
                        queryKey: [
                            isAuthenticated,
                            user?.id,
                            "friends",
                            FRIEND_REQUEST_STATUS.PENDING,
                            "to",
                        ],
                    }),

                    queryClient.invalidateQueries({
                        queryKey: [
                            isAuthenticated,
                            user?.id,
                            "friends",
                            FRIEND_REQUEST_STATUS.REJECTED,
                            "to",
                        ],
                    }),
                ]);
            }
        },
    });

    const rejectFriendRequestMutation = useMutation({
        mutationFn: async (requestId: string) => {
            const msg = await friendService.updateFriendRequestStatus(
                FRIEND_REQUEST_STATUS.REJECTED,
                requestId
            );

            infoToast(msg);

            if (msg.toLowerCase().includes("updated")) {
                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: [
                            isAuthenticated,
                            user?.id,
                            "friends",
                            FRIEND_REQUEST_STATUS.ACCEPTED,
                            "from",
                        ],
                    }),

                    queryClient.invalidateQueries({
                        queryKey: [
                            isAuthenticated,
                            user?.id,
                            "friends",
                            FRIEND_REQUEST_STATUS.REJECTED,
                            "to", // request where logged in user is sent request
                        ],
                    }),

                    queryClient.invalidateQueries({
                        queryKey: [
                            isAuthenticated,
                            user?.id,
                            "friends",
                            FRIEND_REQUEST_STATUS.PENDING,
                            "to",
                        ],
                    }),
                ]);
            }
        },
    });

    const getStatusForFriendRequest = useCallback(
        function (friendUserId: string) {
            if (!isAuthenticated) {
                return undefined;
            } else {
                // Check if the user's request has been rejected
                if (rejectedRequestsQuery.data) {
                    const request = rejectedRequestsQuery.data.find(
                        (request) => request.toUser.id === friendUserId
                    );
                    if (request)
                        return {
                            status: FRIEND_REQUEST_STATUS.REJECTED,
                            type: "rejected" as const,
                        };
                }

                // Check if the user has blocked friendUserId
                if (blockedRequestsQuery.data) {
                    const request = blockedRequestsQuery.data.find(
                        (request) => request.fromUser.id === friendUserId
                    );
                    if (request)
                        return {
                            status: FRIEND_REQUEST_STATUS.REJECTED,
                            type: "blocked" as const,
                        };
                }

                // Check if the fromUserId has sent a request
                if (receivedRequestsQuery.data) {
                    const request = receivedRequestsQuery.data.find(
                        (request) => request.fromUser.id === friendUserId
                    );
                    if (request)
                        return {
                            status: FRIEND_REQUEST_STATUS.PENDING,
                            type: "received" as const,
                        };
                }

                // Check if the user has sent a request
                if (sentRequestsQuery.data) {
                    const request = sentRequestsQuery.data.find(
                        (request) => request.toUser.id === friendUserId
                    );
                    if (request)
                        return {
                            status: FRIEND_REQUEST_STATUS.PENDING,
                            type: "sent" as const,
                        };
                }

                // Check if the user has accepted a request
                if (friends) {
                    const friend = friends.find(
                        (f) => f.friend.id === friendUserId
                    );
                    if (friend)
                        return {
                            status: FRIEND_REQUEST_STATUS.ACCEPTED,
                            type: "accepted" as const,
                        };
                }
            }
        },
        [
            isAuthenticated,
            friends,
            sentRequestsQuery.data,
            rejectedRequestsQuery.data,
            acceptedFriendsQuery.data,
            receivedRequestsQuery,
            blockedRequestsQuery,
        ]
    );

    return {
        sendRequest: {
            mutation: sendRequestMutation.mutateAsync,
            isPending: sendRequestMutation.isPending,
        },
        acceptRequest: {
            mutation: acceptFriendRequestMutation.mutateAsync,
            isPending: acceptFriendRequestMutation.isPending,
        },
        rejectRequest: {
            mutation: rejectFriendRequestMutation.mutateAsync,
            isPending: rejectFriendRequestMutation.isPending,
        },
        friends,
        receivedRequestsQuery,
        sentRequestsQuery,
        rejectedRequestsQuery,
        blockedRequestsQuery,
        getStatusForFriendRequest,
    };
}

export function useSearchFriends() {
    const { user, isAuthenticated } = useUser();
    const [text, setText] = useState("");

    const query = useQuery({
        queryKey: [isAuthenticated, user?.id, "searchFriends", text],
        enabled: isAuthenticated && text.length > 2,
        queryFn: async () => {
            const [ok, err] =
                await friendService.searchFriendsByUsernameOrUserId(text);

            if (err || !ok) {
                return [] as unknown as NonNullable<typeof ok>["friends"];
            }

            return ok.friends;
        },
        staleTime: 1000 * 30, // 30secs
    });

    const friends = useMemo(
        function transformAcceptedFriends() {
            return (
                query.data?.map((friend) => {
                    return {
                        ...friend,
                        friend:
                            user!.id === friend.toUser.id
                                ? friend.fromUser
                                : friend.toUser,
                    };
                }) ?? []
            );
        },
        [query.data]
    );

    return {
        friends,
        isLoading: query.isLoading,
        searchText: text,
        changeSearchText: setText,
    };
}

export function useDirectMessageRoom(friendId: string | undefined) {
    const { socket, isConnected } = useContext(SocketContext);
    const { isAuthenticated, user } = useUser();

    useEffect(
        function handleDirectMessageSocket() {
            if (socket && isConnected && isAuthenticated && user && friendId) {
                socket.emit("joinDirectMessage", { friendId });

                window.addEventListener("beforeunload", handleUnload);

                return function cleanUpDirectMessageSocket() {
                    handleUnload();
                    window.removeEventListener("beforeunload", handleUnload);
                };
            }

            function handleUnload() {
                if (
                    socket &&
                    isConnected &&
                    isAuthenticated &&
                    user &&
                    friendId
                ) {
                    socket.emit("leaveDirectMessage", { friendId });
                }
            }
        },
        [socket, isConnected, isAuthenticated, user?.id, friendId]
    );
}

export function useListenToDirectMessages(friendId: string | undefined) {
    const { socket, isConnected } = useContext(SocketContext);
    const { isAuthenticated, user } = useUser();
    const [hasConnected, setHasConnected] = useState(false);

    useEffect(
        function listenToDMs() {
            if (socket && isConnected && isAuthenticated && user && friendId) {
                socket.on("directMessage", receivedMessage);
                setHasConnected(true);
            }

            window.addEventListener("beforeunload", handleUnload);

            return function cleanUpDirectMessageSocket() {
                handleUnload();
                window.removeEventListener("beforeunload", handleUnload);
            };

            function handleUnload() {
                if (
                    socket &&
                    isConnected &&
                    isAuthenticated &&
                    user &&
                    friendId
                ) {
                    socket.off("directMessage", receivedMessage);
                    setHasConnected(false);
                }
            }

            function receivedMessage(data: unknown) {
                console.log({ data });
            }
        },
        [socket, isConnected, isAuthenticated, user?.id]
    );

    return { hasConnected };
}
