import { useAuth } from '../auth/auth-context.ts'
import AuthForm from './AuthForm.tsx'

function Login() {
  const { login } = useAuth()
  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      onSubmit={login}
      footer={{ text: 'No account yet?', linkLabel: 'Sign up', to: '/signup' }}
    />
  )
}

export default Login
