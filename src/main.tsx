import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './auth/AuthContext.tsx'
import AuthCompletePage from './auth/AuthCompletePage.tsx'
import ForgotPasswordPage from './auth/ForgotPasswordPage.tsx'
import LoginPage from './auth/LoginPage.tsx'
import RequireAuth from './auth/RequireAuth.tsx'
import ResetPasswordPage from './auth/ResetPasswordPage.tsx'
import SignupPage from './auth/SignupPage.tsx'
import VerifyEmailPage from './auth/VerifyEmailPage.tsx'
import ResumeBuilder from './ResumeBuilder.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/complete" element={<AuthCompletePage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <ResumeBuilder />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
