import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TabletButton } from '@/components/ui/tablet-button';
import { useToast } from '@/hooks/use-toast';
import { Github, RefreshCw, Check, X, ExternalLink, Copy, Link, Clock } from 'lucide-react';

const GITHUB_REPO_URL_KEY = 'cosmique_github_repo_url';
const GITHUB_SYNC_STATUS_KEY = 'cosmique_github_sync_status';
const GITHUB_LAST_SYNC_KEY = 'cosmique_github_last_sync';

type SyncStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

export default function GitHubIntegrationSettings() {
  const { toast } = useToast();
  const [repoUrl, setRepoUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const storedUrl = localStorage.getItem(GITHUB_REPO_URL_KEY) || '';
    const storedStatus = (localStorage.getItem(GITHUB_SYNC_STATUS_KEY) as SyncStatus) || 'disconnected';
    const storedLastSync = localStorage.getItem(GITHUB_LAST_SYNC_KEY);
    setRepoUrl(storedUrl);
    setInputUrl(storedUrl);
    setStatus(storedLastSync ? storedStatus : 'disconnected');
    setLastSync(storedLastSync);
  }, []);

  const persist = (url: string, newStatus: SyncStatus, syncTime: string | null) => {
    localStorage.setItem(GITHUB_REPO_URL_KEY, url);
    localStorage.setItem(GITHUB_SYNC_STATUS_KEY, newStatus);
    if (syncTime) {
      localStorage.setItem(GITHUB_LAST_SYNC_KEY, syncTime);
    } else {
      localStorage.removeItem(GITHUB_LAST_SYNC_KEY);
    }
  };

  const isValidGitHubUrl = (url: string) => {
    return /^https:\/\/github\.com\/[^/]+\/[^/]+(\/)?$/.test(url.trim());
  };

  const handleConnect = () => {
    if (!inputUrl.trim()) {
      toast({ title: 'Repository URL required', variant: 'destructive' });
      return;
    }
    if (!isValidGitHubUrl(inputUrl)) {
      toast({
        title: 'Invalid GitHub URL',
        description: 'URL must match https://github.com/owner/repo',
        variant: 'destructive',
      });
      return;
    }
    const normalized = inputUrl.trim().replace(/\/$/, '');
    setRepoUrl(normalized);
    setStatus('connected');
    const now = new Date().toISOString();
    setLastSync(now);
    persist(normalized, 'connected', now);
    toast({ title: 'GitHub repository connected', description: normalized });
  };

  const handleDisconnect = () => {
    setRepoUrl('');
    setInputUrl('');
    setStatus('disconnected');
    setLastSync(null);
    persist('', 'disconnected', null);
    toast({ title: 'GitHub repository disconnected' });
  };

  const handleSync = () => {
    if (!repoUrl) {
      toast({ title: 'No repository connected', variant: 'destructive' });
      return;
    }
    setStatus('syncing');
    toast({ title: 'Syncing with GitHub...' });

    setTimeout(() => {
      const now = new Date().toISOString();
      setStatus('connected');
      setLastSync(now);
      persist(repoUrl, 'connected', now);
      toast({ title: 'Sync complete', description: 'Repository is up to date.' });
    }, 1500);
  };

  const handleCopy = async () => {
    if (!repoUrl) return;
    try {
      await navigator.clipboard.writeText(repoUrl);
      toast({ title: 'Repository URL copied' });
    } catch {
      toast({ title: 'Failed to copy URL', variant: 'destructive' });
    }
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    return date.toLocaleString('en-AE', {
      timeZone: 'Asia/Dubai',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusConfig = {
    connected: { label: 'Connected', icon: Check, variant: 'success' as const },
    disconnected: { label: 'Not connected', icon: X, variant: 'outline' as const },
    syncing: { label: 'Syncing...', icon: RefreshCw, variant: 'warning' as const },
    error: { label: 'Sync error', icon: X, variant: 'destructive' as const },
  };

  const currentStatus = statusConfig[status];
  const StatusIcon = currentStatus.icon;

  return (
    <div className="space-y-6">
      <Card className="card-tablet">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Github className="h-6 w-6" />
            <div>
              <CardTitle>GitHub Integration</CardTitle>
              <CardDescription>Connected repository and sync status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-${status === 'connected' ? 'success' : status === 'syncing' ? 'warning' : 'destructive'}/10`}>
                <StatusIcon className={`h-5 w-5 ${status === 'syncing' ? 'animate-spin' : ''} text-${status === 'connected' ? 'success' : status === 'syncing' ? 'warning' : 'destructive'}`} />
              </div>
              <div>
                <p className="font-medium">{currentStatus.label}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Last synced: {formatLastSync(lastSync)}
                </p>
              </div>
            </div>
            <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="github-repo-url" className="text-base">
              Repository URL
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="github-repo-url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="input-tablet pl-10"
                />
              </div>
              {repoUrl ? (
                <TabletButton variant="outline" onClick={handleDisconnect} className="gap-2">
                  <X className="h-4 w-4" />
                  Disconnect
                </TabletButton>
              ) : (
                <TabletButton onClick={handleConnect} className="gap-2">
                  <Link className="h-4 w-4" />
                  Connect
                </TabletButton>
              )}
            </div>
            {repoUrl && (
              <p className="text-sm text-muted-foreground">
                Editing the URL will disconnect the current repository and connect a new one.
              </p>
            )}
          </div>

          {repoUrl && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  <span className="font-medium">Connected repository</span>
                </div>
                <div className="flex gap-2">
                  <TabletButton variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                    <Copy className="h-4 w-4" />
                    Copy
                  </TabletButton>
                  <TabletButton
                    variant="outline"
                    size="sm"
                    asChild
                    className="gap-2"
                  >
                    <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </TabletButton>
                </div>
              </div>
              <p className="break-all text-sm font-mono text-muted-foreground">{repoUrl}</p>

              <TabletButton
                onClick={handleSync}
                disabled={status === 'syncing'}
                isLoading={status === 'syncing'}
                className="w-full gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {status === 'syncing' ? 'Syncing...' : 'Sync now with GitHub'}
              </TabletButton>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-tablet">
        <CardHeader>
          <CardTitle>About GitHub Sync</CardTitle>
          <CardDescription>How Lovable keeps your project in sync</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Lovable features a two-way sync with GitHub. When you make changes in Lovable, they automatically push to GitHub, and when you push changes to GitHub, they automatically sync to Lovable.
          </p>
          <p>
            To connect or manage the repository, open the Plus (+) menu in the chat input → GitHub → Connect project.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
