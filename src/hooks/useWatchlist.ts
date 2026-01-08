import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { WatchlistGroup, WatchlistItem, WatchlistStateResponse } from '../types/api';

const watchlistQueryKey = ['watchlist'] as const;
const EMPTY_GROUPS: WatchlistGroup[] = [];

export type UseWatchlist = {
  groups: WatchlistGroup[];
  isLoading: boolean;
  error: unknown;
  refresh: () => void;
  createGroup: (name: string) => Promise<string | null>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  addItems: (groupId: string, items: WatchlistItem[]) => Promise<void>;
  removeItems: (groupId: string, tsCodes: string[]) => Promise<void>;
  upsertItem: (groupId: string, item: WatchlistItem) => Promise<void>;
};

export function useWatchlist(): UseWatchlist {
  const queryClient = useQueryClient();

  const watchlistQuery = useQuery({
    queryKey: watchlistQueryKey,
    queryFn: () => api.getWatchlist(),
    staleTime: 5_000,
    retry: 1,
  });

  const groups = watchlistQuery.data?.groups ?? EMPTY_GROUPS;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
  }, [queryClient]);

  const createGroup = useCallback(
    async (name: string) => {
      const group = await api.createWatchlistGroup(name);
      queryClient.setQueryData<WatchlistStateResponse>(watchlistQueryKey, (prev) => {
        const nextGroup = { ...group, items: [] };
        if (!prev) return { version: 1, groups: [nextGroup] };
        return { ...prev, groups: [nextGroup, ...prev.groups.filter((g) => g.id !== group.id)] };
      });
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
      return group.id ?? null;
    },
    [queryClient]
  );

  const renameGroup = useCallback(
    async (groupId: string, name: string) => {
      await api.updateWatchlistGroup(groupId, name);
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
    },
    [queryClient]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      await api.deleteWatchlistGroup(groupId);
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
    },
    [queryClient]
  );

  const addItems = useCallback(
    async (groupId: string, items: WatchlistItem[]) => {
      if (items.length === 0) return;
      await api.upsertWatchlistItems(groupId, { items });
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
    },
    [queryClient]
  );

  const removeItems = useCallback(
    async (groupId: string, tsCodes: string[]) => {
      if (tsCodes.length === 0) return;
      await api.removeWatchlistItems(groupId, { ts_codes: tsCodes });
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey });
    },
    [queryClient]
  );

  const upsertItem = useCallback(
    async (groupId: string, item: WatchlistItem) => addItems(groupId, [item]),
    [addItems]
  );

  return useMemo(
    () => ({
      groups,
      isLoading: watchlistQuery.isLoading,
      error: watchlistQuery.error,
      refresh,
      createGroup,
      renameGroup,
      deleteGroup,
      addItems,
      removeItems,
      upsertItem,
    }),
    [
      addItems,
      createGroup,
      deleteGroup,
      groups,
      refresh,
      removeItems,
      renameGroup,
      upsertItem,
      watchlistQuery.error,
      watchlistQuery.isLoading,
    ]
  );
}
