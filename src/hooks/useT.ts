import { useEditor } from '../store/EditorContext';
import { t } from '../utils/i18n';

export function useT() {
  const { state } = useEditor();
  const lang = state.settings.language;
  return (key: string, args?: Record<string, string | number>) => t(key, lang, args);
}
