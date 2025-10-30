import Login from "./components/Pages/Login/Login";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import FacilityDetail from "./components/Pages/FacilityDetail/FacilityDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* raíz redirige al dashboard */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/espacio/:id"
          element={
            <ProtectedRoute>
              <FacilityDetail />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// import Login from "./components/Pages/Login/Login";
// import { BrowserRouter, Routes, Route } from "react-router-dom";
// import Dashboard from "./components/Pages/Dashboard/Dashboard";
// import { AuthProvider } from "./components/contexts/AuthContext";
// import ProtectedRoute from "./components/ProtectedRoute";
// import FacilityDetail from "./components/Pages/FacilityDetail/FacilityDetail";

// function App() {
//   return (
//     <AuthProvider>
//       <BrowserRouter>
//         <Routes>
//           <Route path="/login" element={<Login />} />
//           <Route
//             path="/"
//             element={
//               <ProtectedRoute>
//                 <Dashboard />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/cancha/:id"
//             element={
//               <ProtectedRoute>
//                 <FacilityDetail />
//               </ProtectedRoute>
//             }
//           />
//         </Routes>
//       </BrowserRouter>
//     </AuthProvider>
//   );
// }

// export default App;
