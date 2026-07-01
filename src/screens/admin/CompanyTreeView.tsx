import { useState } from 'react';
import type { Company } from '../../api/companiesApi';

export interface CompanyTreeNode {
  id: number;
  name: string;
  parentCompanyId: number | null;
  children: CompanyTreeNode[];
}

export function buildCompanyTree(companies: Company[]): CompanyTreeNode[] {
  const map = new Map<number, CompanyTreeNode>();
  for (const c of companies) {
    map.set(c.id, { id: c.id, name: c.name, parentCompanyId: c.parentCompanyId, children: [] });
  }
  const roots: CompanyTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentCompanyId === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentCompanyId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }
  const sortNodes = (nodes: CompanyTreeNode[]): CompanyTreeNode[] => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortNodes(n.children);
    return nodes;
  };
  return sortNodes(roots);
}

interface CompanyTreeViewProps {
  nodes: CompanyTreeNode[];
  onAddChild: (node: CompanyTreeNode) => void;
  onEdit: (node: CompanyTreeNode) => void;
  onDelete: (node: CompanyTreeNode) => void;
}

interface CompanyTreeNodesProps {
  nodes: CompanyTreeNode[];
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  onAddChild: (node: CompanyTreeNode) => void;
  onEdit: (node: CompanyTreeNode) => void;
  onDelete: (node: CompanyTreeNode) => void;
}

function CompanyTreeNodes({
  nodes,
  collapsed,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: CompanyTreeNodesProps) {
  return (
    <ul className="role-tree">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsed.has(node.id);

        return (
          <li key={node.id} className="role-tree-node">
            <div className="role-tree-row">
              {hasChildren ? (
                <button
                  type="button"
                  className="role-tree-icon-btn"
                  aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
                  onClick={() => onToggle(node.id)}
                >
                  <span className={`role-tree-chevron${isCollapsed ? '' : ' expanded'}`}>
                    &#9654;
                  </span>
                </button>
              ) : (
                <span className="role-tree-icon-btn" aria-hidden="true" style={{ visibility: 'hidden' }}>
                  <span className="role-tree-chevron">&#9654;</span>
                </span>
              )}

              <span className="role-tree-name">{node.name}</span>

              <div className="role-tree-actions">
                <button
                  type="button"
                  className="role-tree-icon-btn"
                  aria-label={`Add child company under ${node.name}`}
                  onClick={() => onAddChild(node)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="role-tree-icon-btn"
                  aria-label={`Edit ${node.name}`}
                  onClick={() => onEdit(node)}
                >
                  &#9998;
                </button>
                <button
                  type="button"
                  className="role-tree-icon-btn danger"
                  aria-label={`Delete ${node.name}`}
                  onClick={() => onDelete(node)}
                >
                  &#10005;
                </button>
              </div>
            </div>

            {hasChildren && !isCollapsed && (
              <CompanyTreeNodes
                nodes={node.children}
                collapsed={collapsed}
                onToggle={onToggle}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CompanyTreeView({ nodes, onAddChild, onEdit, onDelete }: CompanyTreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const handleToggle = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <CompanyTreeNodes
      nodes={nodes}
      collapsed={collapsed}
      onToggle={handleToggle}
      onAddChild={onAddChild}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}
