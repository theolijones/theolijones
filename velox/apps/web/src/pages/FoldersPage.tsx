import { useState } from 'react';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FolderTree } from '@/components/folders/FolderTree';
import { useFolderTree, useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/use-folders';
import { useVideos } from '@/hooks/use-videos';
import { VideoCard } from '@/components/videos/VideoCard';

export function FoldersPage() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const { data: treeData, isLoading: foldersLoading } = useFolderTree();
  const { data: videosData } = useVideos({ folderId: selectedFolderId });
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const folderTree = treeData?.data || [];
  const videos = videosData?.data || [];

  const handleCreateFolder = async (parentId?: string) => {
    const name = prompt('Folder name:');
    if (!name) return;
    await createFolder.mutateAsync({ name, parentId });
  };

  const handleRenameFolder = async () => {
    if (!selectedFolderId) return;
    const name = prompt('New folder name:');
    if (!name) return;
    await updateFolder.mutateAsync({ id: selectedFolderId, name });
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolderId) return;
    if (!confirm('Delete this folder? It must be empty.')) return;
    try {
      await deleteFolder.mutateAsync(selectedFolderId);
      setSelectedFolderId(undefined);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Folders"
        description="Organise videos into a hierarchical folder structure"
        actions={
          <button
            onClick={() => handleCreateFolder(undefined)}
            className="flex items-center gap-2 px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Folder
          </button>
        }
      />

      <div className="flex gap-6">
        {/* Folder tree */}
        <div className="w-64 shrink-0">
          <div className="bg-velox-surface rounded-xl border border-velox-border p-3">
            {foldersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-5 h-5 border-2 border-velox-accent border-t-transparent rounded-full" />
              </div>
            ) : (
              <FolderTree
                folders={folderTree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onCreateFolder={handleCreateFolder}
              />
            )}
          </div>
        </div>

        {/* Folder content */}
        <div className="flex-1 min-w-0">
          {selectedFolderId ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen className="w-5 h-5 text-velox-accent" />
                <span className="text-sm font-medium">Folder contents</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleRenameFolder}
                    className="p-2 text-velox-text-muted hover:text-velox-text-primary bg-velox-surface border border-velox-border rounded-lg transition-colors"
                    title="Rename folder"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteFolder}
                    className="p-2 text-velox-text-muted hover:text-velox-red bg-velox-surface border border-velox-border rounded-lg transition-colors"
                    title="Delete folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {videos.length === 0 ? (
                <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
                  <p className="text-sm text-velox-text-secondary">This folder is empty</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {videos.map((video) => (
                    <VideoCard key={video.id} video={video} view="list" />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
              <FolderOpen className="w-10 h-10 text-velox-text-muted mx-auto mb-3" />
              <p className="text-sm text-velox-text-secondary">
                Select a folder to view its contents
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
