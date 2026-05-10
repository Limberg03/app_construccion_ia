import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { ToastProvider } from './hooks/useToast.jsx'
import { DashboardPage } from './pages/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ToastViewport } from './ui/ToastViewport.jsx'

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function RedirectIfAuthed({ children }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <ToastViewport />
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <LoginPage />
                </RedirectIfAuthed>
              }
            />

            <Route
              path="/register"
              element={
                <RedirectIfAuthed>
                  <RegisterPage />
                </RedirectIfAuthed>
              }
            />

            <Route
              path="/"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />

            <Route
              path="/proyecto/:id/editor"
              element={
                <RequireAuth>
                  <EditorPage />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
