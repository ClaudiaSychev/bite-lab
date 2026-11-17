import { useAuth } from '../auth/auth-context.ts'
import AuthForm from './AuthForm.tsx'

function Signup() {
  const { signup } = useAuth()
  return (
    <AuthForm
      title="Sign up"
      submitLabel="Create account"
      onSubmit={signup}
      minPasswordLength={8}
      footer={{ text: 'Already have an account?', linkLabel: 'Log in', to: '/login' }}
    />
  )
}

export default Signup
