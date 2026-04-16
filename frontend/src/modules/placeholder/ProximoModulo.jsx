import { useParams } from 'react-router-dom'
import ModuleLayout from '../_shared/ModuleLayout.jsx'

export default function ProximoModulo() {
  const { slot } = useParams()
  return (
    <ModuleLayout title="Módulo en preparación">
      <p className="module-lead">
        Espacio reservado para un futuro mini sistema (hueco {slot}). Cuando exista el módulo,
        conviene crear una carpeta nueva bajo <code className="module-code">src/modules/</code> y
        enlazarla desde el registro.
      </p>
    </ModuleLayout>
  )
}
