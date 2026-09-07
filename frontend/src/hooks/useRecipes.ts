import { useInfiniteQuery } from '@tanstack/react-query';
import { pb } from '../lib/pocketbase';
import type { RecipeRecord, TargetUser } from '../types';

export function useRecipesQuery(activeGroup: TargetUser, activeCategory: string) {
  return useInfiniteQuery({
    queryKey: ['recipes', activeGroup, activeCategory],
    queryFn: async ({ pageParam = 1 }) => {
      const filterConditions: string[] = [];
      if (activeGroup) {
        filterConditions.push(`target_user = "${activeGroup}"`);
      }
      if (activeCategory && activeCategory !== '全部') {
        filterConditions.push(`category = "${activeCategory}"`);
      }
      const filterStr = filterConditions.join(' && ');

      const result = await pb.collection('recipes').getList<RecipeRecord>(
        pageParam as number,
        4,
        {
          sort: '-created',
          filter: filterStr || undefined,
        }
      );
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });
}
