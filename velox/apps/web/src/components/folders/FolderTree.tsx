import { useState } from 'react';
import { ChevronRight, FolderOpen, Folder as FolderIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Folder } from '@velox/shared';

interface FolderNode extends Folder {
  children: FolderNode[];
}

interface FolderTreeProps {
  folders: FolderNode[];
  selectedFolderId?: string;
  onSelectFolder: (id: string | undefined) => void;
  onCreateFolder?: (parentId?: string) => void;
}

function FolderItem({
  folder,
  depth,
  selectedId,
  onSelect,
  onCreateFolder,
}: {
  folder: FolderNode;
  depth: number;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onCreateFolder?: (parentId?: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const hasChildren = folder.children.length > 0;
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(isSelected ? undefined : folder.id);
          if (hasChildren) setIsOpen(!isOpen);
        }}
        className={cn(
          'w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-sm transition-colors group',
          isSelected
            ? 'bg-velox-accent-muted text-velox-accent'
            : 'text-velox-text-secondary hover:text-velox-text-primary hover:bg-velox-surface-hover'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 shrink-0 transition-transform',
            hasChildren ? '' : 'invisible',
            isOpen && 'rotate-90'
          )}
        />
        {isSelected || isOpen ? (
          <FolderOpen className="w-4 h-4 shrink-0" />
        ) : (
          <FolderIcon className="w-4 h-4 shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{folder.name}</span>
        <span className="text-[10px] font-mono text-velox-text-muted shrink-0">
          {folder.videoCount}
        </span>
        {onCreateFolder && (
          <Plus
            className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 shrink-0 text-velox-text-muted hover:text-velox-accent"
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(folder.id);
            }}
          />
        )}
      </button>
      {isOpen && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreateFolder={onCreateFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({ folders, selectedFolderId, onSelectFolder, onCreateFolder }: FolderTreeProps) {
  return (
    <div className="space-y-0.5">
      {/* All Videos */}
      <button
        onClick={() => onSelectFolder(undefined)}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors',
          !selectedFolderId
            ? 'bg-velox-accent-muted text-velox-accent'
            : 'text-velox-text-secondary hover:text-velox-text-primary hover:bg-velox-surface-hover'
        )}
      >
        <FolderOpen className="w-4 h-4" />
        <span>All Videos</span>
      </button>

      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          depth={0}
          selectedId={selectedFolderId}
          onSelect={onSelectFolder}
          onCreateFolder={onCreateFolder}
        />
      ))}

      {onCreateFolder && (
        <button
          onClick={() => onCreateFolder(undefined)}
          className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-xs text-velox-text-muted hover:text-velox-accent transition-colors mt-2"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>
      )}
    </div>
  );
}
