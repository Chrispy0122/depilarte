from fastapi import APIRouter, Depends

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.modules.agenda import models as agenda_models
from datetime import datetime, timedelta
import re

# ─── Auth / Tenant (same pattern as agenda router) ──────────────────────────
class DummyUsuario:
    def __init__(self, negocio_id: int):
        self.negocio_id = negocio_id

def get_current_usuario(authorization: str = Header(None)):
    """Extrae negocio_id del token JWT almacenado en localStorage."""
    if authorization:
        match = re.search(r"tenant-(\d+)", authorization)
        if match:
            return DummyUsuario(negocio_id=int(match.group(1)))
    # Fallback al tenant 1
    return DummyUsuario(negocio_id=1)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

@router.get("/resumen")
def obtener_resumen(offset_semanas: int = 0, db: Session = Depends(get_db)):

def obtener_resumen(
    offset_semanas: int = 0,
    db: Session = Depends(get_db),
    usuario_actual: DummyUsuario = Depends(get_current_usuario)
):
    # 1. DEFINIR RANGO DE FECHAS
    today = datetime.now()
    target_date = today + timedelta(weeks=offset_semanas)
    
    start_of_week = target_date - timedelta(days=target_date.weekday()) # Monday
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    # STRICT RANGE: Show only ONE week (7 days total)
    end_of_week = start_of_week + timedelta(days=6) # Sunday of current target week
    end_of_week = end_of_week.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    start_date = start_of_week.date()
    end_date = end_of_week.date()

    # 2. PASO 1 - LA LISTA MAESTRA (Clientes de Retención)
    from backend.modules.pacientes import models as paciente_models
    
    # Query: Todos los clientes con fecha sugerida hasta el final de esta semana (incluye atrasados)
    # Y que BO tengan una cita futura CONFIRMADA
    from sqlalchemy import and_, exists, not_
    
    today_date = datetime.now().date()
    
    # LOGIC CHANGE: 3-State Behavior
    # 1. PAST: Empty
    if end_date < today_date:
        clientes_retencion = []
        
    # 2. PRESENT: Cumulative (Backlog + Current Week)
    elif start_date <= today_date <= end_date:
subquery_confirmed_future = exists().where(
            and_(
                agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                agenda_models.Cita.fecha_hora_inicio > datetime.now(),
                agenda_models.Cita.estado.ilike('%confirmada%')

# Excluir pacientes que YA tienen una cita futura válida (no cancelada).
        # Nota: solo excluimos citas activas; si todas sus citas futuras fueron canceladas,
        # el paciente SERÁ incluido en la lista de retención correctamente.
        ESTADOS_CANCELADOS_STR = ['CANCELLED', 'cancelada', 'cancelado', 'cancelled']
        subquery_tiene_futura_valida = exists().where(
            and_(
                agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                agenda_models.Cita.fecha_hora_inicio > datetime.now(),
                agenda_models.Cita.negocio_id == usuario_actual.negocio_id,
                agenda_models.Cita.estado.notin_(ESTADOS_CANCELADOS_STR)
            )
        )
        clientes_retencion = db.query(paciente_models.Cliente).filter(
            paciente_models.Cliente.fecha_proxima_estimada <= end_date,
not_(subquery_confirmed_future)

not_(subquery_tiene_futura_valida)
        ).order_by(paciente_models.Cliente.fecha_proxima_estimada.asc()).all()

    # 3. FUTURE: Strict Window (No Backlog)
    else:
# start_date > today_date
        subquery_confirmed_future = exists().where(
            and_(
                agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                agenda_models.Cita.fecha_hora_inicio > datetime.now(),
                agenda_models.Cita.estado.ilike('%confirmada%')
            )
        )
        clientes_retencion = db.query(paciente_models.Cliente).filter(
            paciente_models.Cliente.fecha_proxima_estimada >= start_date, # Strict Start
            paciente_models.Cliente.fecha_proxima_estimada <= end_date,
            not_(subquery_confirmed_future)

# Usar la misma lógica de exclusión: negar citas futuras válidas (no canceladas)
        ESTADOS_CANCELADOS_STR = ['CANCELLED', 'cancelada', 'cancelado', 'cancelled']
        subquery_tiene_futura_valida = exists().where(
            and_(
                agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                agenda_models.Cita.fecha_hora_inicio > datetime.now(),
                agenda_models.Cita.negocio_id == usuario_actual.negocio_id,
                agenda_models.Cita.estado.notin_(ESTADOS_CANCELADOS_STR)
            )
        )
        clientes_retencion = db.query(paciente_models.Cliente).filter(
            paciente_models.Cliente.fecha_proxima_estimada >= start_date,
            paciente_models.Cliente.fecha_proxima_estimada <= end_date,
            not_(subquery_tiene_futura_valida)
        ).order_by(paciente_models.Cliente.fecha_proxima_estimada.asc()).all()

    # 3. PASO 2 - CRUCE CON AGENDA Y UNIFICACIÓN
    # Recuperar citas de la semana para cruzar
    # Asegurar que traemos el cliente asociado para poder mostrarlo si no estaba en la lista de retención
    citas_this_week = db.query(agenda_models.Cita).filter(
        agenda_models.Cita.fecha_hora_inicio >= start_of_week,
agenda_models.Cita.fecha_hora_inicio <= end_of_week
    ).all()
    
    citas_map = {c.cliente_id: c for c in citas_this_week}

agenda_models.Cita.fecha_hora_inicio <= end_of_week,
        agenda_models.Cita.negocio_id == usuario_actual.negocio_id
    ).all()

    # citas_map: solo citas NO canceladas
    # Si la unica cita del paciente esta semana fue cancelada,
    # citas_map.get(cliente.id) devuelve None y lo clasifica como "Por Agendar".
    ESTADOS_CANCELADOS_CITAS = {'CANCELLED', 'cancelada', 'cancelado', 'cancelled'}
    citas_map = {
        c.cliente_id: c
        for c in citas_this_week
        if str(c.estado) not in ESTADOS_CANCELADOS_CITAS
    }
    
    # UNIFICACIÓN DE LISTAS
    # Queremos mostrar:
    # 1. Clientes que deben venir (Retención) -> "Por Agendar" (o "Agendado" si coinciden)
    # 2. Clientes que YA tienen cita esta semana (aunque su fecha estimada no coincida) -> "Confirmado/Agendado"
    
    clientes_unificados = {}
    
    # A. Agregar clientes de retención
    for c in clientes_retencion:
        clientes_unificados[c.id] = c
        
    # B. Agregar clientes con cita (que no estén ya)
    for cita in citas_this_week:
        if cita.cliente_id not in clientes_unificados and cita.cliente:
            clientes_unificados[cita.cliente_id] = cita.cliente
# C. RESCATE DE CANCELADOS (Churn Prevention)
    # Busca pacientes con cita CANCELADA en los últimos 14 días
    # y sin ninguna cita futura válida (no cancelada).
    # Solo aplica cuando estamos viendo la semana actual (offset = 0).
    clientes_rescate_ids = set()  # IDs marcados para el badge especial
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
            # Tiene al menos una cita cancelada en los últimos 14 días
            exists().where(
                and_(
                    agenda_models.Cita.cliente_id == paciente_models.Cliente.id,
                    agenda_models.Cita.fecha_hora_inicio >= ventana_cancelados,
                    agenda_models.Cita.estado.in_(['CANCELLED', 'cancelada', 'cancelado'])
                )
            ),
            # Pero NO tiene ninguna cita futura vigente
            not_(subquery_tiene_futura)
        ).all()

        for pac in pacientes_cancelados:
            if pac.id not in clientes_unificados:
                clientes_unificados[pac.id] = pac
            clientes_rescate_ids.add(pac.id)
            
    # Convertir a lista y procesar
    # Ordenar: Prioridad a los que tienen cita (por fecha cita), luego los de retención (por fecha estimada)
    lista_clientes = list(clientes_unificados.values())
    
    citas_semana_json = []

# Variables para KPIs (Paso 3)
    count_confirmadas = 0
    count_pendientes = 0 # Agrupa "Por Agendar" y "Agendado" (No confirmado)
    
    # KPIs desagregados para el frontend

# Variables para KPIs de la tabla de seguimiento (Paso 3)
    count_por_agendar = 0
    count_agendadas = 0
    
    # Helper para ordenamiento
    def get_sort_key(cliente):
        cita = citas_map.get(cliente.id)
        if cita:
            return cita.fecha_hora_inicio
        # Si no tiene cita, usar fecha estimada
        if cliente.fecha_proxima_estimada:
            # Check if it's already datetime or date
            if isinstance(cliente.fecha_proxima_estimada, datetime):
                return cliente.fecha_proxima_estimada
            return datetime.combine(cliente.fecha_proxima_estimada, datetime.min.time())
        
        # Si no tiene ni cita ni fecha estimada, poner al final
        return datetime.max

    # Sort list
    lista_clientes.sort(key=get_sort_key)

    for cliente in lista_clientes:
        cita = citas_map.get(cliente.id)
        
        estado_accion = "Por Agendar"
        estado_cita_actual = "por_agendar"
        cita_id = 0
        
        # Fecha a mostrar: La de la cita real, o la estimada
        if cita:
            dt_base = cita.fecha_hora_inicio
        elif cliente.fecha_proxima_estimada:
            if isinstance(cliente.fecha_proxima_estimada, datetime):
                 dt_base = cliente.fecha_proxima_estimada
            else:
                 dt_base = datetime.combine(cliente.fecha_proxima_estimada, datetime.min.time()).replace(hour=8)
        else:
            # Fallback si no tiene nada
            dt_base = datetime.now()
            
        fecha_display = dt_base.isoformat()

        if cita:
            # SI TIENE CITA
            cita_id = cita.id

            estado_str = str(cita.estado).lower() if cita.estado else ""
            estado_cita_actual = cita.estado.value if hasattr(cita.estado, 'value') else cita.estado

            if "confirmada" in estado_str:
                estado_accion = "Confirmado"
count_confirmadas += 1
            else:
                # Tiene cita pero no confirmada -> "Agendado"
                estado_accion = "Agendado"
                count_agendadas += 1
count_pendientes += 1

elif cliente.id in clientes_rescate_ids:
            # PACIENTE DE RESCATE: canceló y no tiene cita futura
            estado_accion = "Canceló - Recuperar"
            count_por_agendar += 1
            estado_cita_actual = "cancelado"
        else:
            # SI NO TIENE CITA -> CRITICO: "Por Agendar"
            estado_accion = "Por Agendar"
            count_por_agendar += 1
count_pendientes += 1
            estado_cita_actual = "por_agendar"

        # Fecha estimada segura
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
"fecha_estimada": fecha_estimada_str
        })

    # 4. PASO 3 - CALCULAR KPIs
    count_totales = len(clientes_retencion)

"fecha_estimada": fecha_estimada_str,
            "motivo": "Canceló - Recuperar" if cliente.id in clientes_rescate_ids else None
        })

    # 4. PASO 3 - CALCULAR KPIs DIRECTAMENTE DESDE EL ARREGLO DE CITAS
    # Se itera sobre `citas_this_week` (no sobre la lista de pacientes) para garantizar
    # que las citas de pacientes nuevos (aún no en caché de ORM) también se contabilicen.
    # Estados que cuentan como "confirmadas" para el KPI:
    # - 'confirmada': cita confirmada, aun pendiente de atender
    # - 'pagada': cita ya atendida y cobrada (el cliente asistio y pago)
    # - 'asistio': cita ya atendida pero aun no cobrada
    # Esto es consistente con agenda.js que pinta los 3 en color verde.
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
"pendientes": count_pendientes, # Suma de Por Agendar + Agendado
            
            # Additional Breakdown for detailed Charts
            "por_agendar": count_por_agendar,
            "agendadas": count_agendadas,

"pendientes": count_pendientes,  # Suma de Por Agendar + Agendado

            # Breakdown para gráficos detallados
            "por_agendar": count_por_agendar,
            "agendadas": count_agendadas,
            "porcentaje_confirmacion": 0
        },
        "citas_semana": citas_semana_json
    }
