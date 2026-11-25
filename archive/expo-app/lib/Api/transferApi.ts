import { api } from "../api";

export interface TransferItem {
  productId: string;
  quantity: number;
}

export interface BranchTransfer {
  id?: string;
  transferNumber?: string;
  type: 'warehouse_to_warehouse' | 'warehouse_to_shop' | 'shop_to_warehouse' | 'shop_to_shop';
  status?: 'pending' | 'in_transit' | 'completed' | 'cancelled' | 'rejected';
  sourceWarehouseId?: string;
  sourceShopId?: string;
  destinationWarehouseId?: string;
  destinationShopId?: string;
  sourceWarehouseName?: string;
  sourceShopName?: string;
  destinationWarehouseName?: string;
  destinationShopName?: string;
  items: TransferItem[];
  notes?: string;
  rejectionReason?: string;
  expectedDate?: string;
  completedDate?: string;
  createdByName?: string;
  createdById?: string;
  approvedByName?: string;
  approvedById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransferRequest {
  id?: string;
  itemName: string;
  quantity: number;
  fromBranchId: string;
  toBranchId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  status: 'pending' | 'approved' | 'in_transit' | 'completed' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const transferApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Branch Transfers
    getBranchTransfers: builder.query({
      query: ({ page = 1, limit = 10, status, branchId }) => {
        let url = `transfers?page=${page}&limit=${limit}`;
        if (status) url += `&status=${status}`;
        if (branchId) url += `&branchId=${branchId}`;
        return url;
      },
      transformResponse: (response: {
        data: {
          data: BranchTransfer[];
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }) => response.data,
    }),
    
    createBranchTransfer: builder.mutation({
      query: (transfer: Omit<BranchTransfer, 'id' | 'transferNumber' | 'createdAt' | 'updatedAt' | 'sourceWarehouseName' | 'sourceShopName' | 'destinationWarehouseName' | 'destinationShopName' | 'createdByName' | 'approvedByName' | 'createdById'>) => ({
        url: 'transfers',
        method: 'POST',
        body: transfer,
      }),
      transformResponse: (response: { data: BranchTransfer }) => response.data,
    }),
    
    updateTransferStatus: builder.mutation({
      query: ({ id, status }: { id: string; status: string }) => ({
        url: `transfers/${id}`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (response: { data: BranchTransfer }) => response.data,
    }),
    
    getTransferById: builder.query({
      query: (id: string) => `transfers/${id}`,
      transformResponse: (response: { data: BranchTransfer }) => response.data,
    }),

    // Transfer Requests (using the correct backend endpoint)
    getTransferRequests: builder.query({
      query: ({ page = 1, limit = 10, status, branchId }) => {
        let url = `transfers/request?page=${page}&limit=${limit}`;
        if (status) url += `&status=${status}`;
        if (branchId) url += `&branchId=${branchId}`;
        return url;
      },
      transformResponse: (response: {
        data: {
          data: TransferRequest[];
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }) => response.data,
    }),
    
    createTransferRequest: builder.mutation({
      query: (request: Omit<TransferRequest, 'id' | 'createdAt' | 'updatedAt'>) => ({
        url: 'transfers/request',
        method: 'POST',
        body: request,
      }),
      transformResponse: (response: { data: TransferRequest }) => response.data,
    }),
    
    updateRequestStatus: builder.mutation({
      query: ({ id, status, approvedBy }: { id: string; status: string; approvedBy?: string }) => ({
        url: `transfers/${id}/status`,
        method: 'PATCH',
        body: { status, approvedBy },
      }),
      transformResponse: (response: { data: TransferRequest }) => response.data,
    }),

    // Branch and Product data for transfers
    getBranches: builder.query({
      query: () => 'branches',
      transformResponse: (response: { data: any[] }) => response.data,
    }),
    
    getProductsForTransfer: builder.query({
      query: ({ branchId, search }) => {
        let url = `branches/${branchId}/products`;
        if (search) url += `?search=${search}`;
        return url;
      },
      transformResponse: (response: { data: any[] }) => response.data,
    }),
  }),
});

export const {
  useGetBranchTransfersQuery,
  useCreateBranchTransferMutation,
  useUpdateTransferStatusMutation,
  useGetTransferByIdQuery,
  useGetTransferRequestsQuery,
  useCreateTransferRequestMutation,
  useUpdateRequestStatusMutation,
  useGetBranchesQuery,
  useGetProductsForTransferQuery,
} = transferApi;