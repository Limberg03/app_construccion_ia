import { useEffect, useMemo, useState } from 'react'

import { http } from '../../api/config'
import { Button } from '../../ui/Button'
import { Table } from '../../ui/Table'

function toErrorMessage(err) {
	return (
		err?.response?.data?.detail ||
		err?.message ||
		'Ocurrió un error inesperado'
	)
}

export function VisualizacionProyecto({ proyecto, onClose, onEnterPlano, embedded = false }) {
	const proyectoId = proyecto?.id

	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState('')

	const [planos, setPlanos] = useState([])
	const [presupuestos, setPresupuestos] = useState([])
	const [items, setItems] = useState([])

	const latestPresupuestoId = useMemo(() => {
		const first = Array.isArray(presupuestos) ? presupuestos[0] : null
		return first?.id ?? null
	}, [presupuestos])

	useEffect(() => {
		let mounted = true
		async function run() {
			if (!proyectoId) return
			setIsLoading(true)
			setError('')
			setPlanos([])
			setPresupuestos([])
			setItems([])

			try {
				const [planosRes, presupuestosRes] = await Promise.all([
					http.get('/api/planos/', { params: { proyecto: proyectoId } }),
					http.get('/api/presupuestos/', { params: { proyecto: proyectoId } }),
				])

				if (!mounted) return
				const planosData = Array.isArray(planosRes.data) ? planosRes.data : []
				const presupuestosData = Array.isArray(presupuestosRes.data)
					? presupuestosRes.data
					: []

				setPlanos(planosData)
				setPresupuestos(presupuestosData)

				const firstPresupuestoId = presupuestosData[0]?.id
				if (!firstPresupuestoId) return

				const itemsRes = await http.get('/api/presupuestos/items/', {
					params: { presupuesto: firstPresupuestoId },
				})
				if (!mounted) return
				setItems(Array.isArray(itemsRes.data) ? itemsRes.data : [])
			} catch (e) {
				if (!mounted) return
				setError(String(toErrorMessage(e)))
			} finally {
				if (mounted) setIsLoading(false)
			}
		}

		run()
		return () => {
			mounted = false
		}
	}, [proyectoId])

	const planoPrincipal = planos?.[0] ?? null
	const tienePresupuesto = Array.isArray(items) && items.length > 0

	const planoArchivoUrl = useMemo(() => {
		const raw = planoPrincipal?.archivo
		if (!raw) return ''
		if (String(raw).startsWith('http://') || String(raw).startsWith('https://')) {
			return String(raw)
		}
		const base = String(http?.defaults?.baseURL ?? '').replace(/\/$/, '')
		if (!base) return String(raw)
		if (String(raw).startsWith('/')) return `${base}${raw}`
		return `${base}/${raw}`
	}, [planoPrincipal?.archivo])

	const planoArchivoTipo = useMemo(() => {
		const u = String(planoArchivoUrl || '').toLowerCase()
		if (!u) return 'none'
		if (u.endsWith('.pdf')) return 'pdf'
		if (u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.webp') || u.endsWith('.gif')) {
			return 'image'
		}
		return 'other'
	}, [planoArchivoUrl])

	if (!proyectoId) return null

	return (
		<section className={embedded ? '' : 'mb-6'}>
			{embedded ? null : (
				<div className="flex items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold text-slate-900 dark:text-white">
							Visualización previa
						</h2>
						<p className="text-sm text-slate-600 dark:text-slate-300">
							{proyecto?.titulo ?? 'Proyecto'}
						</p>
					</div>

					<div className="flex gap-2">
						{typeof onEnterPlano === 'function' ? (
							<Button size="sm" onClick={() => onEnterPlano()}>
								Entrar al Plano
							</Button>
						) : null}
						<Button variant="secondary" size="sm" onClick={onClose}>
							Cerrar
						</Button>
					</div>
				</div>
			)}

			{error && (
				<div
					className="mt-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800"
					role="alert"
				>
					<span className="font-medium">Error:</span> {error}
				</div>
			)}

			<div className="mt-4 grid gap-4 xl:grid-cols-2">
				<div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
					<div className="flex items-center justify-between">
						<div>
							<div className="text-sm font-semibold text-slate-900 dark:text-white">
								Editor (vista previa)
							</div>
							<div className="text-xs text-slate-600 dark:text-slate-300">
								{isLoading
									? 'Cargando…'
									: planoPrincipal
										? `Plano: ${planoPrincipal.nombre ?? `#${planoPrincipal.id}`}`
										: 'Sin planos'}
							</div>
						</div>
						<div className="text-xs text-slate-500 dark:text-slate-400">
							{planos?.length ? `${planos.length} plano(s)` : ''}
						</div>
					</div>

					<div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] p-3 min-h-[240px]">
						{isLoading ? (
							<div className="text-sm text-slate-600 dark:text-slate-300">
								Cargando información del plano…
							</div>
						) : planoPrincipal ? (
							<div className="space-y-3">
								{planoArchivoUrl ? (
									<a
										className="text-sm text-purple-600 dark:text-[#38BDF8] hover:underline"
										href={planoArchivoUrl}
										target="_blank"
										rel="noreferrer"
									>
										Abrir archivo del plano
									</a>
								) : (
									<div className="text-sm text-slate-600 dark:text-slate-300">
										No hay archivo cargado.
									</div>
								)}

								<div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 overflow-hidden">
									{planoArchivoTipo === 'image' ? (
										<img
											src={planoArchivoUrl}
											alt={planoPrincipal?.nombre ?? 'Plano'}
											className="w-full h-[240px] object-contain bg-white/50 dark:bg-slate-950"
											loading="lazy"
										/>
									) : planoArchivoTipo === 'pdf' ? (
										<iframe
											src={planoArchivoUrl}
											title="Plano"
											className="w-full h-[240px] bg-white dark:bg-slate-950"
										/>
									) : (
										<div className="p-4 text-sm text-slate-600 dark:text-slate-300">
											No se puede previsualizar este tipo de archivo.
										</div>
									)}
								</div>
							</div>
						) : (
							<div className="text-sm text-slate-600 dark:text-slate-300">
								Este proyecto no tiene planos todavía.
							</div>
						)}
					</div>
				</div>

				{tienePresupuesto ? (
					<div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm font-semibold text-slate-900 dark:text-white">
									Presupuesto
								</div>
								<div className="text-xs text-slate-600 dark:text-slate-300">
									{latestPresupuestoId
										? `Presupuesto #${latestPresupuestoId}`
										: '—'}
								</div>
							</div>
							<div className="text-xs text-slate-500 dark:text-slate-400">
								{items.length} item(s)
							</div>
						</div>

						<div className="mt-3">
							<Table
								columns={[
									{
										key: 'material',
										header: 'Material',
										render: (r) => String(r?.material ?? ''),
									},
									{
										key: 'cantidad',
										header: 'Cantidad',
										render: (r) => String(r?.cantidad ?? ''),
									},
									{
										key: 'precio_unitario',
										header: 'P. Unit',
										render: (r) => String(r?.precio_unitario ?? ''),
									},
									{
										key: 'subtotal',
										header: 'SubTotal',
										render: (r) => String(r?.subtotal ?? ''),
									},
								]}
								rows={items}
								rowKey="id"
							/>
						</div>
					</div>
				) : null}
			</div>

			{!isLoading && !error && !planoPrincipal && !tienePresupuesto && (
				<div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
					Este proyecto no tiene información para previsualizar todavía.
				</div>
			)}
		</section>
	)
}
