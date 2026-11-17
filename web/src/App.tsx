import { Route, Routes } from 'react-router'
import AuthProvider from './auth/AuthProvider.tsx'
import RequireAuth from './auth/RequireAuth.tsx'
import Home from './routes/Home.tsx'
import Login from './routes/Login.tsx'
import PublicRecipe from './routes/PublicRecipe.tsx'
import PublishedRecipes from './routes/PublishedRecipes.tsx'
import RecipeEditor from './routes/RecipeEditor.tsx'
import Recipes from './routes/Recipes.tsx'
import Signup from './routes/Signup.tsx'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/r/:slug" element={<PublicRecipe />} />
        <Route element={<RequireAuth />}>
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/published" element={<PublishedRecipes />} />
          <Route path="/recipes/:id" element={<RecipeEditor />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
