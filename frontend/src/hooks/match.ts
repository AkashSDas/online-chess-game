import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { SocketContext } from "../lib/websocket";
import { useUser } from "./auth";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { matchService } from "../services/match";
import { useAppToast } from "./ui";
import { CHESS_PIECES, CHESS_PIECE_COLOR, MATCH_STATUS } from "../utils/chess";
import { useAppDispatch, useAppSelector } from "./store";
import { matchActions, matchSelectors } from "../store/match/slice";
import { v4 as uuid } from "uuid";

export function useSearchMatchRoom() {
    const { socket, isConnected } = useContext(SocketContext);
    const { isAuthenticated, user } = useUser();

    useEffect(
        function handleSearchMatchSocket() {
            if (socket && isConnected && isAuthenticated && user) {
                socket.emit("joinSearchPlayerForGame", { userId: user.id });

                window.addEventListener("beforeunload", handleUnload);

                return function cleanUpSearchMatchSocket() {
                    handleUnload();
                    window.removeEventListener("beforeunload", handleUnload);
                };
            }

            function handleUnload() {
                if (socket && isConnected && isAuthenticated && user) {
                    socket.emit("leaveSearchPlayerForGame", {
                        userId: user.id,
                    });
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [socket, isConnected, isAuthenticated, user?.id]
    );
}

const FoundPlayerForMatchSchema = z.object({
    opponentUser: z.object({
        id: z.string(),
        username: z.string(),
        profilePic: z.object({
            URL: z.string(),
            id: z.string().optional(),
        }),
        winPoints: z.number().min(0),
    }),
    matchId: z.string(),
});

export function useSearchMatch() {
    const { socket, isConnected } = useContext(SocketContext);
    const { isAuthenticated, user } = useUser();
    const navigate = useNavigate();

    /** Search players whose winPoints are +10 or -10 of the current user */
    const winPointsDiff = useRef(10);

    const cancelSearch = useCallback(
        function () {
            if (socket) {
                socket.emit("leaveSearchPlayerForGame", {
                    userId: user?.id,
                });
            }
        },
        [socket, user]
    );

    useEffect(
        function searchMatch() {
            let interval: ReturnType<typeof setInterval>;

            if (socket && isConnected && isAuthenticated) {
                interval = setInterval(function checkIfPlayerFound() {
                    socket.emit("searchPlayerForGame", {
                        userId: user?.id,
                        addedAt: new Date(),
                        winPoints: user?.winPoints,
                        winPointsOffset: winPointsDiff.current,
                    });

                    // If we didn't find a player whose rank is around current player's
                    // then we increase the diff
                    winPointsDiff.current += 10;
                }, 1000);
            }

            window.addEventListener("beforeunload", handleUnload);

            return function cleanUpSearchMatch() {
                handleUnload();
                window.removeEventListener("beforeunload", handleUnload);
            };

            function handleUnload() {
                if (
                    socket &&
                    isConnected &&
                    isAuthenticated &&
                    user &&
                    interval
                ) {
                    clearInterval(interval);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [socket, isConnected, isAuthenticated, user?.id]
    );

    useEffect(function listenToFoundMatch() {
        if (socket && isConnected && isAuthenticated) {
            socket.on("foundPlayerForMatch", receiveFoundMatch);
        }

        return function cleanUpFoundMatch() {
            if (socket && isConnected && isAuthenticated) {
                socket.off("foundPlayerForMatch", receiveFoundMatch);
            }
        };

        function receiveFoundMatch(data: unknown) {
            const result = FoundPlayerForMatchSchema.safeParse(data);
            if (result.success) {
                navigate(`/match/${result.data.matchId}`);
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { cancelSearch };
}

export function useGetMatch() {
    const params = useParams();
    const { isAuthenticated, user } = useUser();
    const navigate = useNavigate();
    const { errorToast } = useAppToast();
    const dispatch = useAppDispatch();

    const { isLoading, data } = useQuery({
        queryKey: [params.matchId, isAuthenticated],
        enabled: isAuthenticated && !!params.matchId,
        queryFn: async () => {
            const [ok, err] = await matchService.getById(params.matchId!);

            if (err || !ok) {
                errorToast(err?.message ?? "Failed to get match");
                navigate("/");
                return null;
            } else {
                const latestBoard = ok.match.moves[ok.match.moves.length - 1];
                const data = latestBoard.board.map((row, i) =>
                    row.map((col, j) => {
                        const color =
                            (i + j) % 2 == 0
                                ? CHESS_PIECE_COLOR.BLACK
                                : CHESS_PIECE_COLOR.WHITE;

                        return {
                            id: uuid(),
                            piece: col.type
                                ? {
                                      type: col.type,
                                      color: col.color!,
                                  }
                                : null,
                            color: color,
                            selected: false,
                            showPath: false,
                            showExplosion: false,
                            showKingDangerPath: false,
                        };
                    })
                );

                dispatch(matchActions.changeBoard(data));

                // The latest turn would be last played turn, which means now we can change turn
                dispatch(
                    matchActions.changeTurn(
                        latestBoard.turn === CHESS_PIECE_COLOR.BLACK
                            ? CHESS_PIECE_COLOR.WHITE
                            : CHESS_PIECE_COLOR.BLACK
                    )
                );

                dispatch(matchActions.changeMatchStatus(ok.match.status));

                return ok;
            }
        },
    });

    const players = useMemo(
        function () {
            if (data && user) {
                if (data.match.player1.id === user.id) {
                    return {
                        opponent: {
                            user: data.match.player2,
                            color: data.match.player2Color,
                        },
                        me: {
                            user: data.match.player1,
                            color: data.match.player1Color,
                        },
                    };
                } else {
                    return {
                        opponent: {
                            user: data.match.player1,
                            color: data.match.player1Color,
                        },
                        me: {
                            user: data.match.player2,
                            color: data.match.player2Color,
                        },
                    };
                }
            } else {
                return null;
            }
        },
        [user?.id, data]
    );

    return {
        isLoading,
        players,
        matchId: data?.match.id,
        matchStatus: data?.match.status,
    };
}

export function useMatchRoom() {
    const { socket, isConnected } = useContext(SocketContext);
    const { isAuthenticated, user } = useUser();
    const { matchId } = useGetMatch();

    useEffect(
        function handleSearchMatchSocket() {
            if (socket && isConnected && isAuthenticated && user && matchId) {
                socket.emit("joinMatchRoom", { matchId });

                window.addEventListener("beforeunload", handleUnload);

                return function cleanUpSearchMatchSocket() {
                    handleUnload();
                    window.removeEventListener("beforeunload", handleUnload);
                };
            }

            function handleUnload() {
                if (socket && isConnected && isAuthenticated && user) {
                    socket.emit("joinMatchRoom", { matchId });
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [socket, isConnected, isAuthenticated, user?.id, matchId]
    );
}

const MatchChessMoveSchema = z
    .object({
        matchId: z.string(),
        playerId: z.string(),
        move: z.object({
            turn: z.nativeEnum(CHESS_PIECE_COLOR),
            board: z.array(
                z.array(
                    z.object({
                        color: z.nativeEnum(CHESS_PIECE_COLOR).nullable(),
                        type: z.nativeEnum(CHESS_PIECES).nullable(),
                    })
                )
            ),
        }),
        status: z.nativeEnum(MATCH_STATUS),
    })
    .strict({ message: "Extra fields not allowed" });

export function useListenMatchRoom() {
    const { socket, isConnected } = useContext(SocketContext);
    const { isAuthenticated, user } = useUser();
    const { matchId } = useGetMatch();
    const board = useAppSelector(matchSelectors.board);
    const currentTurn = useAppSelector(matchSelectors.currentTurn);
    const status = useAppSelector(matchSelectors.status);
    const initialLoad = useRef(true);
    const dispatch = useAppDispatch();

    useEffect(
        function handleSearchMatchSocket() {
            if (socket && isConnected && isAuthenticated && user && matchId) {
                socket.on("matchChessMove", receiveMatchChessMove);
            }

            return function cleanUpSearchMatchSocket() {
                if (socket && isConnected && isAuthenticated && user) {
                    socket.off("matchChessMove", receiveMatchChessMove);
                }
            };

            function receiveMatchChessMove(data: unknown) {
                const result = MatchChessMoveSchema.safeParse(data);
                console.log({ result });

                if (result.success) {
                    const { matchId, playerId, move } = result.data;

                    if (matchId === matchId && playerId !== user?.id) {
                        dispatch(matchActions.changeTurn(move.turn));

                        const data = move.board.map((row, i) =>
                            row.map((col, j) => {
                                const color =
                                    (i + j) % 2 == 0
                                        ? CHESS_PIECE_COLOR.BLACK
                                        : CHESS_PIECE_COLOR.WHITE;

                                return {
                                    id: uuid(),
                                    piece: col.type
                                        ? {
                                              type: col.type,
                                              color: col.color!,
                                          }
                                        : null,
                                    color: color,
                                    selected: false,
                                    showPath: false,
                                    showExplosion: false,
                                    showKingDangerPath: false,
                                };
                            })
                        );

                        dispatch(matchActions.changeBoard(data));
                    }
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [socket, isConnected, isAuthenticated, user?.id, matchId]
    );

    const makeMove = useCallback(
        function makeMove(data: z.infer<typeof MatchChessMoveSchema>) {
            if (socket && isConnected && isAuthenticated && user) {
                socket.emit("matchChessMove", data);
            }
        },
        [socket, isConnected, isAuthenticated, user?.id]
    );

    useEffect(
        function handleBoardUpdate() {
            if (board && matchId && user && !initialLoad.current) {
                makeMove({
                    matchId: matchId,
                    playerId: user.id,
                    move: {
                        // Since when a move is made, Redux get's updated, the turn is changed
                        // and then this effect is ran. Since we want to send move made
                        // we've to consider the previous turn where the move was made
                        // and not the latest turn.
                        turn:
                            currentTurn === CHESS_PIECE_COLOR.BLACK
                                ? CHESS_PIECE_COLOR.WHITE
                                : CHESS_PIECE_COLOR.BLACK,
                        board: board.map((row) => {
                            return row.map((piece) => {
                                return {
                                    color: piece.piece?.color ?? null,
                                    type: piece.piece?.type ?? null,
                                };
                            });
                        }),
                    },
                    status,
                });
            } else {
                initialLoad.current = false;
            }
        },
        [currentTurn]
    );
}
