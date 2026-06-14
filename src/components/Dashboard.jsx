import { MAX_CANVASES } from '../lib/useCanvases'
import { IconCanvas, IconCreate, IconX } from './icons/index.jsx'

export default function Dashboard({ profile, canvases, onOpen, onAdd, onRemove }) {
  return (
    <main className="dashboard">
      <h2 className="dashboard-greeting">Hola, {profile.name}</h2>
      <p className="dashboard-sub">Elegí un lienzo para abrir</p>

      <div className="dashboard-grid">
        {canvases.map((c) => (
          <div className="dash-card" key={c.id}>
            <button type="button" className="dash-card-btn" onClick={() => onOpen(c.id)}>
              <span className="dash-card-icon"><IconCanvas size={36} /></span>
              <span className="dash-card-name">{c.name}</span>
            </button>
            <button type="button" className="dash-card-remove" onClick={() => onRemove(c.id)} aria-label={`Eliminar ${c.name}`}>
              <IconX size={14} />
            </button>
          </div>
        ))}

        {canvases.length < MAX_CANVASES && (
          <button type="button" className="dash-card-add" onClick={onAdd}>
            <span className="dash-card-icon"><IconCreate size={32} /></span>
            <span className="dash-card-name">Nuevo lienzo</span>
          </button>
        )}
      </div>

      <p className="dashboard-limit">{canvases.length} de {MAX_CANVASES} lienzos</p>
    </main>
  )
}
