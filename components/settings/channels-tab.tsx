'use client';
import { getChannelIcon } from '@/constants/channels';
import {
 useChannels,
 useConnectChannel,
 useDisconnectChannel,
} from '@/hooks/use-channels';
import { cn } from '@/lib/utils';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';

function ChannelTabContent() {
 const searchParams = useSearchParams();
 const queryClient = useQueryClient();

 const { channels, isPending } = useChannels();
 const connectMutation = useConnectChannel();
 const disconnectMutation = useDisconnectChannel();

 useEffect(() => {
  const connected = searchParams.get('connected');
  const error = searchParams.get('error');
  const channelType = searchParams.get('channelType');

  if (!connected && !error) return;
  queryClient.invalidateQueries({ queryKey: ['channels'] });
  if (connected) {
   toast.success(`Successfully connected to ${channelType}`);
  }
  if (error) {
   toast.error(`Failed to connect to ${channelType}`);
  }
 }, [queryClient, searchParams]);

 const handleConnect = (channelTypeId: string) => {
  if (!channelTypeId || connectMutation.isPending) return;
  connectMutation.mutate(channelTypeId);
 };

 const handleDisconnect = (userChannelId: string) => {
  if (!userChannelId || disconnectMutation.isPending) return;
  disconnectMutation.mutate(userChannelId);
 };

 return (
  <Card>
   <CardHeader>
    <CardTitle>Channels</CardTitle>
    <CardDescription>
     Connect your social media accounts to start scheduling
    </CardDescription>
   </CardHeader>

   <CardContent>
    <div className="space-y-3">
     {isPending
      ? Array.from({ length: 6 }).map((_, index) => (
         <div
          key={index}
          className="flex items-center justify-between rounded-xl border p-4"
         >
          <div className="flex items-center gap-3">
           <Skeleton className="size-6 rounded-sm bg-secondary" />
           <Skeleton className="h-5 w-24 bg-secondary" />
          </div>
          <Skeleton className="h-8 w-20 bg-secondary" />
         </div>
        ))
      : channels?.map((channel) => {
         const icon = getChannelIcon(channel.type);
         return (
          <div
           key={channel.id}
           className="flex items-center justify-between rounded-xl border p-4"
          >
           <div className="flex items-center gap-3">
            <span className="relative">
             {icon ? (
              <HugeiconsIcon
               icon={icon}
               color="currentColor"
               className=" text-white! size-6! p-1 rounded-sm"
               style={{ background: channel.color }}
              />
             ) : null}

             <div
              className={cn(
               `absolute -right-1 bottom-0 p-0.5 bg-white dark:bg-background rounded-xs`,
               {
                'bg-transparent p-0 rounded-full -bottom-1 -right-0.5':
                 channel.connected,
               },
              )}
             >
              {channel.connected ? (
               <div className="size-2.5 bg-primary rounded-full" />
              ) : (
               <HugeiconsIcon
                icon={PlusSignIcon}
                className="size-2!"
               />
              )}
             </div>
            </span>

            <span className="font-medium">{channel.name}</span>
           </div>

           <Button
            variant={channel.connected ? 'destructive' : 'default'}
            size="sm"
            disabled={
             connectMutation.isPending || disconnectMutation.isPending
            }
            onClick={() =>
             channel.connected
              ? handleDisconnect(channel.user_channel_id!)
              : handleConnect(channel.id!)
            }
           >
            {((connectMutation.isPending &&
             connectMutation.variables === channel.id) ||
             (disconnectMutation.isPending &&
              disconnectMutation.variables ===
               channel.user_channel_id)) && (
             <Spinner className="size-4" />
            )}
            {channel.connected ? 'Disconnect' : 'Connect'}
           </Button>
          </div>
         );
        })}
    </div>
   </CardContent>
  </Card>
 );
}

const ChannelsTab = () => {
 return (
  <Suspense
   fallback={
    <div className="text-sm text-muted-foreground">
     Loading channels...
    </div>
   }
  >
   <ChannelTabContent />
  </Suspense>
 );
};

export default ChannelsTab;
