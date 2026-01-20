import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook for managing expeditions data
 */
const useExpeditions = (options = {}) => {
  const {
    autoFetch = true,
    initialFilters = {}
  } = options;

  const [expeditions, setExpeditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  });
  const [filters, setFilters] = useState(initialFilters);

  // Fetch expeditions
  const fetchExpeditions = useCallback(async (page = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await api.getExpeditions({
        page,
        limit: pagination.limit,
        ...filters
      });

      const newExpeditions = response.data?.expeditions || response.data || [];
      const total = response.data?.total || newExpeditions.length;

      if (page === 1) {
        setExpeditions(newExpeditions);
      } else {
        setExpeditions(prev => [...prev, ...newExpeditions]);
      }

      setPagination(prev => ({
        ...prev,
        page,
        total,
        hasMore: page * prev.limit < total
      }));
    } catch (err) {
      setError(err.message || 'Error al cargar expedientes');
      console.error('Error fetching expeditions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, pagination.limit]);

  // Refresh (pull to refresh)
  const refresh = useCallback(() => {
    fetchExpeditions(1, true);
  }, [fetchExpeditions]);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (!loading && pagination.hasMore) {
      fetchExpeditions(pagination.page + 1);
    }
  }, [loading, pagination.hasMore, pagination.page, fetchExpeditions]);

  // Get single expedition
  const getExpedition = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getExpedition(id);
      return response.data;
    } catch (err) {
      setError(err.message || 'Error al cargar expediente');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchExpeditions(1);
    }
  }, [autoFetch, filters]);

  return {
    expeditions,
    loading,
    refreshing,
    error,
    pagination,
    filters,
    refresh,
    loadMore,
    getExpedition,
    updateFilters,
    clearFilters,
    refetch: () => fetchExpeditions(1)
  };
};

/**
 * Hook for single expedition details
 */
export const useExpeditionDetail = (expeditionId) => {
  const [expedition, setExpedition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!expeditionId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.getExpedition(expeditionId);
      setExpedition(response.data);
    } catch (err) {
      setError(err.message || 'Error al cargar expediente');
      console.error('Error fetching expedition:', err);
    } finally {
      setLoading(false);
    }
  }, [expeditionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    expedition,
    loading,
    error,
    refetch: fetch
  };
};

export default useExpeditions;
