import type { RoleTreeNode } from './roleTree';

interface RoleTreeViewProps {
  nodes: RoleTreeNode[];
  onRename: (node: RoleTreeNode) => void;
  onDelete: (node: RoleTreeNode) => void;
}

export function RoleTreeView({ nodes, onRename, onDelete }: RoleTreeViewProps) {
  return (
    <ul className="role-tree">
      {nodes.map((node) => (
        <li key={node.id} className="role-tree-node">
          <div className="role-tree-row">
            <span className="role-tree-name">{node.name}</span>
            {node.isSystemRole && <span className="badge badge-system">System</span>}
            <div className="role-tree-actions">
              <button type="button" className="btn-link" onClick={() => onRename(node)}>
                Rename
              </button>
              {!node.isSystemRole && (
                <button type="button" className="btn-link" onClick={() => onDelete(node)}>
                  Delete
                </button>
              )}
            </div>
          </div>
          {node.children.length > 0 && (
            <RoleTreeView nodes={node.children} onRename={onRename} onDelete={onDelete} />
          )}
        </li>
      ))}
    </ul>
  );
}
