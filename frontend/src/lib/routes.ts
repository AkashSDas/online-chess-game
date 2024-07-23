import { createBrowserRouter } from "react-router-dom";

// Pages
import { HomePage } from "../pages";
import { SignupPage } from "../pages/auth/signup";
import { LoginPage } from "../pages/auth/login";
import { NotificationsPage } from "../pages/user/notifications";
import { SettingsPage } from "../pages/user/settings";
import { HistoryPage } from "../pages/user/history";
import { FriendsPage } from "../pages/user/friends";
import { UserPublicProfilePage } from "../pages/public/user-public-profile";
import { GlobalChatPage } from "../pages/public/global-chat";
import { SearchPlayersPage } from "../pages/public/search-players";
import { LobbyPage } from "../pages/public/lobby";

export const routes: Parameters<typeof createBrowserRouter>[0] = [
    {
        path: "/",
        Component: HomePage,
    },
    {
        path: "/auth/signup",
        Component: SignupPage,
    },
    {
        path: "/auth/login",
        Component: LoginPage,
    },
    {
        path: "/notifications",
        Component: NotificationsPage,
    },
    {
        path: "/settings",
        Component: SettingsPage,
    },
    {
        path: "/history",
        Component: HistoryPage,
    },
    {
        path: "/friends",
        Component: FriendsPage,
    },
    {
        path: "/player/:playerId",
        Component: UserPublicProfilePage,
    },
    {
        path: "/global-chat",
        Component: GlobalChatPage,
    },
    {
        path: "/search",
        Component: SearchPlayersPage,
    },
    {
        path: "/lobby",
        Component: LobbyPage,
    },
];
