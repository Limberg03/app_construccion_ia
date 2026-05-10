import { useNavigate } from 'react-router-dom'

import { VisualizacionProyecto } from '../modules/dashboard/VisualizacionProyecto'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export function ProyectoPreview({ proyecto, onClose }) {
  const navigate = useNavigate()

  const open = Boolean(proyecto?.id)

  return (
    <Modal
      open={open}
      title="Visualización previa"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/proyecto/${proyecto?.id}/editor`)}>
            Entrar al Plano
          </Button>
        </div>
      }
    >
      {/* Forzamos dark sólo dentro del modal para respetar el diseño */}
      <div className="dark">
        <VisualizacionProyecto proyecto={proyecto} embedded />
      </div>
    </Modal>
  )
}
