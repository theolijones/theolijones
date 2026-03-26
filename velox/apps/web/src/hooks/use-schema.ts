import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { MetadataSchema, CustomFieldDefinition, ApiResponse } from '@velox/shared';

export function useSchema() {
  return useQuery({
    queryKey: ['schema'],
    queryFn: () => api.get<ApiResponse<MetadataSchema>>('/schema'),
  });
}

export function useUpdateSchema() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fields: CustomFieldDefinition[]) =>
      api.patch<ApiResponse<MetadataSchema>>('/schema', { fields }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schema'] });
    },
  });
}
