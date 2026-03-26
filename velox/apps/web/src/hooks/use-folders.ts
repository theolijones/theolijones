import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Folder, ApiResponse, CreateFolderInput, UpdateFolderInput } from '@velox/shared';

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: () => api.get<ApiResponse<Folder[]>>('/folders'),
  });
}

export function useFolderTree() {
  return useQuery({
    queryKey: ['folder-tree'],
    queryFn: () => api.get<ApiResponse<(Folder & { children: Folder[] })[]>>('/folders/tree'),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFolderInput) => api.post<ApiResponse<Folder>>('/folders', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateFolderInput & { id: string }) =>
      api.patch<ApiResponse<Folder>>(`/folders/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiResponse>(`/folders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}
