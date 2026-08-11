import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { FilterSectionEditorApp } from './App'
import '../styles.css'
import { bootstrapTheme } from '../shared/apply-theme'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from '../shared/diagnostics'
import { bootstrapLocale, bootstrapLocaleSync, LocaleProvider } from '../shared/locale'

bootstrapLocaleSync()
void bootstrapLocale()
void bootstrapTheme()
installRendererDiagnostics('filter-section-editor')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="filter-section-editor">
      <LocaleProvider>
        <FilterSectionEditorApp />
      </LocaleProvider>
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
