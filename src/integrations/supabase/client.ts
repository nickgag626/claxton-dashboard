// Supabase client stub for Next.js dashboard
// This is a minimal mock that allows the dashboard to run without Supabase

export interface SupabaseQueryResult<T> {
  data: T | null;
  error: Error | null;
}

// Create a chainable mock query builder
const createMockQueryBuilder = () => {
  const mockResult = { data: null, error: null };
  const mockArrayResult = { data: [], error: null };
  
  const builder: any = {
    select: (...args: any[]) => builder,
    eq: (...args: any[]) => builder,
    neq: (...args: any[]) => builder,
    gt: (...args: any[]) => builder,
    gte: (...args: any[]) => builder,
    lt: (...args: any[]) => builder,
    lte: (...args: any[]) => builder,
    like: (...args: any[]) => builder,
    ilike: (...args: any[]) => builder,
    is: (...args: any[]) => builder,
    in: (...args: any[]) => builder,
    contains: (...args: any[]) => builder,
    containedBy: (...args: any[]) => builder,
    rangeGt: (...args: any[]) => builder,
    rangeGte: (...args: any[]) => builder,
    rangeLt: (...args: any[]) => builder,
    rangeLte: (...args: any[]) => builder,
    rangeAdjacent: (...args: any[]) => builder,
    overlaps: (...args: any[]) => builder,
    textSearch: (...args: any[]) => builder,
    match: (...args: any[]) => builder,
    not: (...args: any[]) => builder,
    or: (...args: any[]) => builder,
    filter: (...args: any[]) => builder,
    order: (...args: any[]) => builder,
    limit: (...args: any[]) => builder,
    range: (...args: any[]) => builder,
    abortSignal: (...args: any[]) => builder,
    single: async () => mockResult,
    maybeSingle: async () => mockResult,
    csv: async () => ({ data: '', error: null }),
    then: (resolve: (result: any) => void) => {
      resolve(mockArrayResult);
      return Promise.resolve(mockArrayResult);
    },
  };
  
  return builder;
};

// Mock channel subscription
const mockChannel = {
  on: (...args: any[]) => mockChannel,
  subscribe: () => ({ unsubscribe: () => {} }),
};

export const supabase = {
  channel: (name: string) => mockChannel,
  removeChannel: (channel: any) => {},
  from: (table: string) => {
    const builder = createMockQueryBuilder();
    return {
      ...builder,
      insert: (data: any) => ({
        ...createMockQueryBuilder(),
        select: (...args: any[]) => createMockQueryBuilder(),
      }),
      update: (data: any) => ({
        ...createMockQueryBuilder(),
      }),
      upsert: (data: any) => ({
        ...createMockQueryBuilder(),
        select: (...args: any[]) => createMockQueryBuilder(),
      }),
      delete: () => createMockQueryBuilder(),
    };
  },
  functions: {
    invoke: async (name: string, opts?: any): Promise<{ data: any; error: Error | null }> => {
      console.log(`[supabase.functions.invoke] ${name}`, opts);
      return { data: null, error: null };
    },
  },
  rpc: async (name: string, params?: any): Promise<SupabaseQueryResult<any>> => {
    console.log(`[supabase.rpc] ${name}`, params);
    return { data: null, error: null };
  },
};

export type SupabaseClient = typeof supabase;
