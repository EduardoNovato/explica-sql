import type { PlanNode } from './types';

const isGather = (node: PlanNode) => node.type === 'Gather' || node.type === 'Gather Merge';

/**
 * Llena el tiempo con hijos, el tiempo propio y su fracción del total en cada nodo.
 *
 * - PostgreSQL da `actual time` por vuelta: el tiempo del nodo es tiempo × loops.
 * - Bajo un Gather, cada worker y el líder suman una vuelta y trabajan a la vez: se divide entre
 *   los procesos para no contar el mismo reloj varias veces.
 * - Los nodos `never executed` valen 0. El tiempo propio nunca baja de 0 (los CTE y InitPlan
 *   pueden contarse en dos lugares).
 *
 * Devuelve el tiempo de referencia: `Execution Time` si existe, si no el de la raíz.
 */
export function computeTiming(nodes: PlanNode[], executionMs?: number): number {
  const processes = new Array<number>(nodes.length).fill(1);
  for (const node of nodes) {
    const parent = node.parentId === undefined ? undefined : nodes[node.parentId];
    if (!parent) continue;
    processes[node.id] = isGather(parent)
      ? (parent.workersLaunched ?? parent.workersPlanned ?? 0) + 1
      : (processes[parent.id] ?? 1);
  }

  for (const node of nodes) {
    const time = node.actual?.totalMs;
    node.inclusiveMs = time === undefined || !node.actual ? 0 : (time * node.actual.loops) / (processes[node.id] ?? 1);
  }

  for (const node of nodes) {
    const children = node.children.reduce((sum, id) => sum + (nodes[id]?.inclusiveMs ?? 0), 0);
    node.selfMs = Math.max(0, node.inclusiveMs - children);
  }

  const totalMs = executionMs ?? nodes[0]?.inclusiveMs ?? 0;
  for (const node of nodes) node.selfShare = totalMs > 0 ? Math.min(1, node.selfMs / totalMs) : 0;
  return totalMs;
}
