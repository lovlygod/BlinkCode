import { Navigate } from 'react-router-dom';

export default function LangRedirect() {
  const isRu = navigator.language.startsWith('ru');
  return <Navigate to={isRu ? '/ru' : '/en'} replace />;
}
