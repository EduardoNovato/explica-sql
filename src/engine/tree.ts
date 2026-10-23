import type { NodeKind, PlanNode } from './types';

/** Pasos que leen filas de una tabla (no de otro nodo, como CTE Scan o una vista) */
const TABLE_READS: NodeKind[] = ['full-scan', 'table-access', 'index-scan'];

export const isTableScan = (node: PlanNode) => TABLE_READS.includes(node.kind) && node.relation !== undefined;

export const childrenOf = (node: PlanNode, nodes: PlanNode[]) =>
  node.children.map((id) => nodes[id]).filter((child): child is PlanNode => child !== undefined);

/** Hijos que forman la consulta principal (sin InitPlan, SubPlan ni CTE) */
export const mainChildren = (node: PlanNode, nodes: PlanNode[]) => childrenOf(node, nodes).filter((child) => !child.subplan);

export function descendants(node: PlanNode, nodes: PlanNode[]): PlanNode[] {
  const found: PlanNode[] = [];
  const pending = [...childrenOf(node, nodes)];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    found.push(current);
    pending.push(...childrenOf(current, nodes));
  }
  return found;
}

/** Cada ancestro junto con el hijo por el que se llega al nodo, del más cercano a la raíz */
export function* ancestors(node: PlanNode, nodes: PlanNode[]): Generator<{ ancestor: PlanNode; via: PlanNode }> {
  let via = node;
  while (via.parentId !== undefined) {
    const ancestor = nodes[via.parentId];
    if (!ancestor) return;
    yield { ancestor, via };
    via = ancestor;
  }
}

/** Nombres con los que las condiciones pueden referirse a la tabla de un nodo */
export function namesOf(node: PlanNode): string[] {
  const names: string[] = [];
  if (node.alias) names.push(node.alias);
  if (node.relation) names.push(node.relation, node.relation.split('.').pop() ?? node.relation);
  return names;
}
