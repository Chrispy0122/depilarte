from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import and_, exists, not_
from backend.database import get_db
from backend.modules.agenda import models as agenda_models
from backend.modules.pacientes import models as paciente_models
from datetime import datetime, timedelta
import re

class DummyUsuario:
    def __init__(self, negocio_id: int):
        self.negocio_id = negocio_id

def get_current_usuario(authorization: str = Header(None)):
    if authorization:
        match = re.search(r"tenant-(\d+)", authorization)
        if match:
            return DummyUsuario(negocio_id=int(match.group(1)))
    return DummyUsuario(negocio_id=1)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

@router.get("/resumen")
def obtener_resumen(
    offset_semanas: int = 0,
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    today = datetime.now()
    target_date = today + timedelta(weeks=offset_semanas)
    
    start_of_week = target_date - timedelta(days=target_date.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_week = start_of_week + timedelta(days=6)
    end_of_week = end_of_week.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    start_date = start_of_week.date()
    end_date = end_of_week.date()

    today_date = datetime.now().date()
    ESTADOS_CANCELADOS_STR = ['CANCELLED', 'cancelada', 'cancelado', 'cancelled']
    
    if end_date < today_date:
        clientes_retencion = []
    else:
        subquery_tiene_futura_valida = exists().where(
            and_(
                agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                agenda_models.Cita.fecha_hora_inicio > datetime.now(),
                agenda_models.Cita.negocio_id == usuario_actual.negocio_id,
                agenda_models.Cita.estado.notin_(ESTADOS_CANCELADOS_STR)
            )
        )
        
        query = db.query(paciente_models.Cliente).filter(
            paciente_models.Cliente.fecha_proxima_estimada <= end_date,
            not_(subquery_tiene_futura_valida)
        )
        if start_date > today_date:
            query = query.filter(paciente_models.Cliente.fecha_proxima_estimada >= start_date)
            
        clientes_retencion = query.order_by(paciente_models.Cliente.fecha_proxima_estimada.asc()).all()

    citas_this_week = db.query(agenda_models.Cita).filter(
        agenda_models.Cita.fecha_hora_inicio >= start_of_week,
        agenda_models.Cita.fecha_hora_inicio <= end_of_week,
        agenda_models.Cita.negocio_id == usuario_actual.negocio_id
    ).all()
    
    ESTADOS_CANCELADOS_CITAS = {'CANCELLED', 'cancelada', 'cancelado', 'cancelled'}
    citas_map = {
        c.cliente_id: c
        for c in citas_this_week
        if str(c.estado) not in ESTADOS_CANCELADOS_CITAS
    }
    
    clientes_unificados = {c.id: c for c in clientes_retencion}
    for cita in citas_this_week:
        if cita.cliente_id not in clientes_unificados and cita.cliente:
            clientes_unificados[cita.cliente_id] = cita.cliente

    clientes_rescate_ids = set()
    if offset_semanas == 0:
        ventana_cancelados = datetime.now() - timedelta(days=14)
        subquery_tiene_futura = exists().where(
            and_(
                agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                agenda_models.Cita.fecha_hora_inicio > datetime.now(),
                agenda_models.Cita.estado.notin_(['CANCELLED', 'cancelada', 'cancelado'])
            )
        )
        pacientes_cancelados = db.query(paciente_models.Cliente).filter(
            paciente_models.Cliente.negocio_id == usuario_actual.negocio_id,
            exists().where(
                and_(
                    agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                    agenda_models.Cita.fecha_hora_inicio >= ventana_cancelados,
                    agenda_models.Cita.estado.in_(['CANCELLED', 'cancelada', 'cancelado'])
                )
            ),
            not_(subquery_tiene_futura)
        ).all()
        for pac in pacientes_cancelados:
            if pac.id not in clientes_unificados:
                clientes_unificados[pac.id] = pac
            clientes_rescate_ids.add(pac.id)
            
    lista_clientes = list(clientes_unificados.values())
    citas_semana_json = []

    def get_sort_key(cliente):
        cita = citas_map.get(cliente.id)
        if cita:
            return cita.fecha_hora_inicio
        if cliente.fecha_proxima_estimada:
            if isinstance(cliente.fecha_proxima_estimada, datetime):
                return cliente.fecha_proxima_estimada
            return datetime.combine(cliente.fecha_proxima_estimada, datetime.min.time())
        return datetime.max

    lista_clientes.sort(key=get_sort_key)

    count_por_agendar = 0
    count_agendadas = 0

    for cliente in lista_clientes:
        cita = citas_map.get(cliente.id)
        estado_accion = "Por Agendar"
        estado_cita_actual = "por_agendar"
        cita_id = 0
        
        if cita:
            dt_base = cita.fecha_hora_inicio
        elif cliente.fecha_proxima_estimada:
            if isinstance(cliente.fecha_proxima_estimada, datetime):
                 dt_base = cliente.fecha_proxima_estimada
            else:
                 dt_base = datetime.combine(cliente.fecha_proxima_estimada, datetime.min.time()).replace(hour=8)
        else:
            dt_base = datetime.now()
            
        fecha_display = dt_base.isoformat()

        if cita:
            cita_id = cita.id
            estado_str = str(cita.estado).lower() if cita.estado else ""
            estado_cita_actual = cita.estado.value if hasattr(cita.estado, 'value') else cita.estado
            if "confirmada" in estado_str:
                estado_accion = "Confirmado"
            else:
                estado_accion = "Agendado"
                count_agendadas += 1
        elif cliente.id in clientes_rescate_ids:
            estado_accion = "Canceló - Recuperar"
            count_por_agendar += 1
            estado_cita_actual = "cancelado"
        else:
            estado_accion = "Por Agendar"
            count_por_agendar += 1
            estado_cita_actual = "por_agendar"

        fecha_estimada_str = ""
        if cliente.fecha_proxima_estimada:
            fecha_estimada_str = cliente.fecha_proxima_estimada.isoformat()

        citas_semana_json.append({
            "id": cita_id,
            "fecha_hora_inicio": fecha_display,
            "cliente_nombre": cliente.nombre_completo,
            "estado": estado_cita_actual,
            "estado_accion": estado_accion,
            "cliente_id": cliente.id,
            "monto": 0,
            "telefono": cliente.telefono,
            "fecha_estimada": fecha_estimada_str,
            "motivo": "Canceló - Recuperar" if cliente.id in clientes_rescate_ids else None
        })

    ESTADOS_CONFIRMADOS = {"confirmada", "confirmado", "pagada", "asistio"}
    count_confirmadas = sum(
        1 for c in citas_this_week
        if str(c.estado).strip().lower() in ESTADOS_CONFIRMADOS
    )
    count_totales = len(citas_this_week)
    count_pendientes = count_por_agendar + count_agendadas

    return {
        "semana_inicio": start_of_week.isoformat(),
        "semana_fin": end_of_week.isoformat(),
        "offset": offset_semanas,
        "kpis": {
            "total_citas": count_totales,
            "confirmadas": count_confirmadas,
            "pendientes": count_pendientes,
            "por_agendar": count_por_agendar,
            "agendadas": count_agendadas,
            "porcentaje_confirmacion": 0
        },
        "citas_semana": citas_semana_json
    }
