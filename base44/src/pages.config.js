import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import ModulePage from './pages/ModulePage';
import Modules from './pages/Modules';
import MyScenarios from './pages/MyScenarios';
import RequestAccess from './pages/RequestAccess';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "Dashboard": Dashboard,
    "ModulePage": ModulePage,
    "Modules": Modules,
    "MyScenarios": MyScenarios,
    "RequestAccess": RequestAccess,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};