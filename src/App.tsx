import Login from "./components/Pages/Login/Login";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import FacilityDetail from "./components/Pages/FacilityDetail/FacilityDetail";
import StudentReservations from "./components/Pages/StudentReservations/StudentReservations";
import EditStudentReservation from "./components/Pages/EditStudentReservation/EditStudentReservation";

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

        <Route
          path="/mis-reservas"
          element={
            <ProtectedRoute>
              <StudentReservations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/edit-reservation/:idReserva"
          element={
            <ProtectedRoute>
              <EditStudentReservation />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
