import type { Role } from '../../api/rolesApi';

export interface RoleTreeNode extends Role {
  children: RoleTreeNode[];
}

/**
 * Builds a forest from the flat RoleDto list using parentRoleId. Normally there is a single root
 * (Super Admin, parentRoleId = null), but any role whose parent isn't present in the list (e.g.
 * a stale reference) is also treated as a root so nothing silently disappears from the tree.
 */
export function buildRoleTree(roles: Role[]): RoleTreeNode[] {
  const nodeById = new Map<number, RoleTreeNode>(
    roles.map((role) => [role.id, { ...role, children: [] }]),
  );
  const roots: RoleTreeNode[] = [];

  for (const node of nodeById.values()) {
    if (node.parentRoleId != null && nodeById.has(node.parentRoleId)) {
      nodeById.get(node.parentRoleId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByName = (nodes: RoleTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortByName(n.children));
  };
  sortByName(roots);

  return roots;
}
