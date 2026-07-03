package com.vinki.videoeditor.timeline

import java.util.ArrayDeque
import java.util.concurrent.atomic.AtomicLong

/**
 * Modelo de composición como Grafo Acíclico Dirigido (DAG).
 *
 * Cada nodo es una etapa de producción de frames (clip, efecto, transición,
 * salida); cada arista "A → B" significa "B consume los frames de A".
 * El orden de render se obtiene por orden topológico (Kahn), que además
 * detecta ciclos residuales como red de seguridad.
 *
 * Las mutaciones validan aciclicidad ANTES de aplicar: el grafo nunca queda
 * en estado corrupto (importante para undo/redo por snapshots).
 */
@JvmInline
value class NodeId(val raw: Long)

sealed interface TimelineNode {
    val id: NodeId
}

/** Clip de medio físico: referencia al archivo + rango de origen. */
data class ClipNode(
    override val id: NodeId,
    val sourceUri: String,
    val sourceInMs: Long,
    val durationMs: Long,
    val speed: Float = 1f
) : TimelineNode {
    init {
        require(durationMs > 0) { "durationMs debe ser > 0" }
        require(speed > 0f) { "speed debe ser > 0" }
    }
}

/** Efecto (chroma key, LUT, blur…) aplicado sobre su única entrada. */
data class EffectNode(
    override val id: NodeId,
    val effectType: EffectType,
    val params: Map<String, Float> = emptyMap()
) : TimelineNode

enum class EffectType { CHROMA_KEY, MOTION_BLUR, LUT, SPEED_RAMP, MASK_AA }

/** Transición entre dos entradas (A = saliente, B = entrante). */
data class TransitionNode(
    override val id: NodeId,
    val kind: TransitionKind,
    val durationMs: Long
) : TimelineNode {
    init {
        require(durationMs > 0) { "durationMs debe ser > 0" }
    }
}

enum class TransitionKind { WIPE_MOTION_BLUR, CROSSFADE, DIP_TO_BLACK }

/** Sumidero: lo que ve el encoder/preview. Exactamente uno por grafo. */
data class OutputNode(override val id: NodeId) : TimelineNode

class GraphCycleException(message: String) : IllegalStateException(message)

class TimelineGraph {

    private val idGen = AtomicLong(1)
    private val nodes = LinkedHashMap<NodeId, TimelineNode>()

    /** adjacency: nodo → consumidores (aristas salientes). */
    private val edges = HashMap<NodeId, MutableSet<NodeId>>()

    fun nextId(): NodeId = NodeId(idGen.getAndIncrement())

    fun add(node: TimelineNode): TimelineNode {
        require(!nodes.containsKey(node.id)) { "Nodo duplicado: ${node.id}" }
        nodes[node.id] = node
        return node
    }

    fun node(id: NodeId): TimelineNode =
        nodes[id] ?: throw NoSuchElementException("Nodo inexistente: $id")

    /**
     * Conecta from → to. Lanza [GraphCycleException] sin mutar el grafo si la
     * arista crearía un ciclo.
     */
    fun connect(from: NodeId, to: NodeId) {
        require(nodes.containsKey(from)) { "Origen inexistente: $from" }
        require(nodes.containsKey(to)) { "Destino inexistente: $to" }
        require(from != to) { "Auto-arista prohibida" }
        if (reaches(to, from)) {
            throw GraphCycleException("Arista $from→$to crearía un ciclo")
        }
        edges.getOrPut(from) { linkedSetOf() }.add(to)
    }

    fun disconnect(from: NodeId, to: NodeId) {
        edges[from]?.remove(to)
    }

    fun remove(id: NodeId) {
        nodes.remove(id) ?: return
        edges.remove(id)
        edges.values.forEach { it.remove(id) }
    }

    /** ¿Existe camino start ⇝ target? BFS iterativo (sin recursión → sin SO). */
    private fun reaches(start: NodeId, target: NodeId): Boolean {
        val visited = HashSet<NodeId>()
        val queue = ArrayDeque<NodeId>()
        queue.add(start)
        while (queue.isNotEmpty()) {
            val current = queue.poll()
            if (current == target) return true
            if (!visited.add(current)) continue
            edges[current]?.forEach(queue::add)
        }
        return false
    }

    /**
     * Orden topológico (Kahn). Es el orden de evaluación del render:
     * un nodo solo se procesa cuando todas sus entradas ya produjeron frame.
     */
    fun renderOrder(): List<TimelineNode> {
        val inDegree = HashMap<NodeId, Int>()
        nodes.keys.forEach { inDegree[it] = 0 }
        edges.values.flatten().forEach { to ->
            inDegree[to] = (inDegree[to] ?: 0) + 1
        }

        val queue = ArrayDeque(nodes.keys.filter { inDegree[it] == 0 })
        val order = ArrayList<TimelineNode>(nodes.size)
        while (queue.isNotEmpty()) {
            val id = queue.poll()
            order.add(node(id))
            edges[id]?.forEach { to ->
                val d = inDegree.getValue(to) - 1
                inDegree[to] = d
                if (d == 0) queue.add(to)
            }
        }
        if (order.size != nodes.size) {
            throw GraphCycleException("Ciclo residual detectado en renderOrder()")
        }
        return order
    }

    /** Snapshot inmutable para undo/redo (estructura compartida, O(n) shallow). */
    fun snapshot(): GraphSnapshot = GraphSnapshot(
        nodes = nodes.toMap(),
        edges = edges.mapValues { it.value.toSet() }
    )

    fun restore(snapshot: GraphSnapshot) {
        nodes.clear()
        nodes.putAll(snapshot.nodes)
        edges.clear()
        snapshot.edges.forEach { (k, v) -> edges[k] = v.toMutableSet() }
    }
}

data class GraphSnapshot(
    val nodes: Map<NodeId, TimelineNode>,
    val edges: Map<NodeId, Set<NodeId>>
)
