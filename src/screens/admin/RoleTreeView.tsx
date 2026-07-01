import { useState } from 'react';
import type { RoleTreeNode } from './roleTree';

interface RoleTreeViewProps {
  nodes: RoleTreeNode[];
  onAddChild: (node: RoleTreeNode) => void;
  onRename: (node: RoleTreeNode) => void;
  onDelete: (node: RoleTreeNode) => void;
}

interface RoleTreeNodesProps {
  nodes: RoleTreeNode[];
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  onAddChild: (node: RoleTreeNode) => void;
  onRename: (node: RoleTreeNode) => void;
  onDelete: (node: RoleTreeNode) => void;
}

function RoleTreeNodes({
  nodes,
  collapsed,
  onToggle,
  onAddChild,
  onRename,
  onDelete,
}: RoleTreeNodesProps) {
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
                /* Reserve space so names align with sibling nodes that have a chevron */
                <span className="role-tree-icon-btn" aria-hidden="true" style={{ visibility: 'hidden' }}>
                  <span className="role-tree-chevron">&#9654;</span>
                </span>
              )}

              <span className="role-tree-name">{node.name}</span>
              {node.isSystemRole && <span className="badge badge-system">System</span>}

              <div className="role-tree-actions">
                <button
                  type="button"
                  className="role-tree-icon-btn"
                  aria-label={`Add child role under ${node.name}`}
                  onClick={() => onAddChild(node)}
                >
                  +
                </button>

                {!node.isSystemRole && (
                  <button
                    type="button"
                    className="role-tree-icon-btn"
                    aria-label={`Rename ${node.name}`}
                    onClick={() => onRename(node)}
                  >
                    &#9998;
                  </button>
                )}

                {!node.isSystemRole && (
                  <button
                    type="button"
                    className="role-tree-icon-btn danger"
                    aria-label={`Delete ${node.name}`}
                    onClick={() => onDelete(node)}
                  >
                    &#10005;
                  </button>
                )}
              </div>
            </div>

            {hasChildren && !isCollapsed && (
              <RoleTreeNodes
                nodes={node.children}
                collapsed={collapsed}
                onToggle={onToggle}
                onAddChild={onAddChild}
                onRename={onRename}
                onDelete={onDelete}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function RoleTreeView({ nodes, onAddChild, onRename, onDelete }: RoleTreeViewProps) {
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
    <RoleTreeNodes
      nodes={nodes}
      collapsed={collapsed}
      onToggle={handleToggle}
      onAddChild={onAddChild}
      onRename={onRename}
      onDelete={onDelete}
    />
  );
}
