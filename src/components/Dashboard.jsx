import { MAX_CANVASES } from '../lib/useCanvases'

export default function Dashboard({
  profile,
  canvases,
  onOpen,
  onAdd,
  onRemove
}) {
  return (
    <main className="dashboard">
      <h2 className="dashboard-greeting">
        Hola, {profile.name} 👋
      </h2>
      <p className="dashboard-sub">Elegí un lienzo para abrir</p>

      <div className="dashboard-grid">
        {canvases.map((c) => (
          <div className="dash-card" key={c.id}>
            <button
              type="button"
              className="dash-card-main"
              onClick={() => onOpen(c.id)}
            >
              <span className="dash-card-icon">🗒️</span>
              <span className="dash-card-name">{c.name}</span>
            </button>

            {/* Mostrar × en cualquier lienzo cuando hay más de uno.
                Si solo hay uno y NO es "Mi lienzo" (podría ser un canvas de
                proyecto huérfano), igual permitir borrarlo para que el usuario
                no quede atrapado. Solo bloqueamos el único lienzo personal
                cuyo nombre es el default — en ese caso el usuario debería
                crear uno nuevo antes de borrar. */}
            {(canvases.length > 1 || c.name !== 'Mi lienzo') && (
              <button
                type="button"
                className="dash-card-remove"
                onClick={() => onRemove(c.id)}
                aria-label={`Eliminar ${c.name}`}
                title="Eliminar este lienzo"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {canvases.length < MAX_CANVASES && (
          <button type="button" className="dash-card dash-card-add" onClick={onAdd}>
            <span className="dash-card-icon">+</span>
            <span className="dash-card-name">Nuevo lienzo</span>
          </button>
        )}
      </div>

      <p className="dashboard-limit">
        {canvases.length} de {MAX_CANVASES} lienzos
      </p>
    </main>
  )
}
