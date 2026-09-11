import { ChannelType } from '@/types/channel.type';
import {
 useMutation,
 useQuery,
 useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

export type ChannelsApiResponse = {
 channels: ChannelType[];
 totalChannels: number;
 connectedCount: number;
};

/**
 * Fetch all available and connected channels for the current user.
 */
export function useChannels() {
 const query = useQuery<ChannelsApiResponse>({
  queryKey: ['channels'],
  queryFn: async () => {
   const res = await fetch('/api/channel');
   const data = await res.json();
   if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch channels');
   }
   return data;
  },
 });

 const channels = query.data?.channels || [];
 const connectedChannels = channels.filter((c) => c.connected);
 const unconnectedChannels = channels.filter((c) => !c.connected);
 const totalChannels = query.data?.totalChannels || 0;
 const connectedCount = query.data?.connectedCount || 0;

 return {
  ...query,
  channels,
  connectedChannels,
  unconnectedChannels,
  totalChannels,
  connectedCount,
 };
}

/**
 * Mutation hook to initiate connecting a social channel.
 */
export function useConnectChannel() {
 return useMutation({
  mutationFn: async (channelTypeId: string) => {
   const res = await fetch('/api/channel/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelTypeId }),
   });
   const data = await res.json();
   if (!res.ok) {
    throw new Error(data.error || 'Failed to start connection');
   }
   return data as { url: string };
  },
  onSuccess: ({ url }) => {
   if (url) {
    window.location.href = url;
   }
  },
  onError: (error: Error) => {
   toast.error(error.message || 'Failed to start connection');
  },
 });
}

/**
 * Mutation hook to disconnect a connected user channel.
 */
export function useDisconnectChannel() {
 const queryClient = useQueryClient();

 return useMutation({
  mutationFn: async (userChannelId: string) => {
   const res = await fetch('/api/channel/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userChannelId }),
   });
   const data = await res.json();
   if (!res.ok) {
    throw new Error(data.error || 'Failed to disconnect channel');
   }
   return data;
  },
  onSuccess: () => {
   toast.success('Channel disconnected successfully');
   queryClient.invalidateQueries({ queryKey: ['channels'] });
  },
  onError: (error: Error) => {
   toast.error(error.message || 'Failed to disconnect channel');
  },
 });
}
