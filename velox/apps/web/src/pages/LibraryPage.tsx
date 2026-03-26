import { useState } from 'react';
import { LayoutGrid, List, PanelLeftClose, PanelLeft, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { VideoCard } from '@/components/videos/VideoCard';
import { FolderTree } from '@/components/folders/FolderTree';
import { UploadDialog } from '@/components/upload/UploadDialog';
import { useVideos } from '@/hooks/use-videos';
import { useFolderTree, useCreateFolder } from '@/hooks/use-folders';
import { cn } from '@/lib/cn';
import type { Video } from '@velox/shared';

export function LibraryPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [folderPanelOpen, setFolderPanelOpen] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: videosData, isLoading: videosLoading } = useVideos({
    folderId: selectedFolderId,
    page,
    limit: view === 'grid' ? 24 : 50,
  });
  const { data: treeData } = useFolderTree();
  const createFolder = useCreateFolder();

  const videos: Video[] = videosData?.data || [];
  const total = videosData?.total || 0;
  const folderTree = treeData?.data || [];

  const filteredVideos = searchQuery
    ? videos.filter(
        (v) =>
          v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : videos;

  const handleCreateFolder = async (parentId?: string) => {
    const name = prompt('Folder name:');
    if (!name) return;
    await createFolder.mutateAsync({ name, parentId });
  };

  return (
    <div>
      <PageHeader
        title="Video Library"
        description={`${total} video${total !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={() => setUploadOpen(true)}
            className="px-4 py-2 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors"
          >
            Upload Video
          </button>
        }
      />

      <div className="flex gap-4">
        {/* Folder panel */}
        {folderPanelOpen && (
          <div className="w-56 shrink-0">
            <div className="bg-velox-surface rounded-xl border border-velox-border p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-velox-text-muted uppercase tracking-wider">
                  Folders
                </span>
                <button
                  onClick={() => setFolderPanelOpen(false)}
                  className="text-velox-text-muted hover:text-velox-text-primary"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <FolderTree
                folders={folderTree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onCreateFolder={handleCreateFolder}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            {!folderPanelOpen && (
              <button
                onClick={() => setFolderPanelOpen(true)}
                className="p-2 text-velox-text-muted hover:text-velox-text-primary bg-velox-surface border border-velox-border rounded-lg transition-colors"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-velox-text-muted" />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-velox-surface border border-velox-border rounded-lg pl-9 pr-3 py-2 text-sm text-velox-text-primary placeholder:text-velox-text-muted focus:outline-none focus:border-velox-accent"
              />
            </div>

            <div className="flex items-center gap-1 bg-velox-surface border border-velox-border rounded-lg p-0.5 ml-auto">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  view === 'grid' ? 'bg-velox-accent-muted text-velox-accent' : 'text-velox-text-muted hover:text-velox-text-primary'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  view === 'list' ? 'bg-velox-accent-muted text-velox-accent' : 'text-velox-text-muted hover:text-velox-text-primary'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {videosLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-velox-accent border-t-transparent rounded-full" />
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="bg-velox-surface rounded-xl border border-velox-border p-12 text-center">
              <p className="text-velox-text-secondary text-sm">
                {searchQuery ? 'No videos match your search' : 'No videos yet. Upload your first video to get started.'}
              </p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredVideos.map((video) => (
                <VideoCard key={video.id} video={video} view="grid" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVideos.map((video) => (
                <VideoCard key={video.id} video={video} view="list" />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between mt-6 text-sm text-velox-text-secondary">
              <span>
                Showing {filteredVideos.length} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-velox-surface border border-velox-border rounded-lg disabled:opacity-50 hover:border-velox-border-light transition-colors"
                >
                  Previous
                </button>
                <span className="font-mono text-xs">Page {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={filteredVideos.length < (videosData?.limit || 25)}
                  className="px-3 py-1.5 bg-velox-surface border border-velox-border rounded-lg disabled:opacity-50 hover:border-velox-border-light transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} folderId={selectedFolderId} />
    </div>
  );
}
