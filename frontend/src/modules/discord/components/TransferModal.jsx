export function TransferModal({ open, currentAreaId, areas, onClose, onConfirm }) {
  if (!open) return null

  function submit(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const areaId = Number(fd.get('area_id'))
    const note = String(fd.get('note') || '').trim()
    onConfirm(areaId, note)
    onClose()
  }

  return (
    <div
      className="dsc-modal-overlay"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div className="dsc-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
        <h3 id="transfer-title">Transferir ticket</h3>
        <form onSubmit={submit}>
          <label className="dsc-field" style={{ width: '100%', marginBottom: '0.75rem' }}>
            <span>Área destino</span>
            <select name="area_id" className="dsc-select" defaultValue={String(currentAreaId || '')} required>
              {areas.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="dsc-field" style={{ width: '100%' }}>
            <span>Nota interna</span>
            <textarea
              name="note"
              className="dsc-textarea"
              placeholder="Motivo o contexto para el equipo destino…"
              rows={4}
            />
          </label>
          <div className="dsc-modal-actions">
            <button type="button" className="dsc-btn dsc-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="dsc-btn dsc-btn--primary">
              Confirmar transferencia
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
