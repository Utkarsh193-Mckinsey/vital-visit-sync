import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle, TabletCardDescription } from "@/components/ui/tablet-card";
import { TabletButton } from "@/components/ui/tablet-button";

// Local typed shim for the beta supabase.auth.oauth namespace.
type OAuthResult = { data?: any; error?: { message: string } | null };
type OAuthClient = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = (supabase.auth as any).oauth as OAuthClient;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      if (!oauth?.getAuthorizationDetails) {
        setError("OAuth server is not available on this project yet.");
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <PageContainer maxWidth="sm" className="flex items-center justify-center">
        <TabletCard className="w-full">
          <TabletCardHeader>
            <TabletCardTitle>Authorization error</TabletCardTitle>
            <TabletCardDescription>{error}</TabletCardDescription>
          </TabletCardHeader>
        </TabletCard>
      </PageContainer>
    );
  }

  if (!details) {
    return (
      <PageContainer maxWidth="sm" className="flex items-center justify-center">
        <div className="text-muted-foreground">Loading authorization request…</div>
      </PageContainer>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an app";

  return (
    <PageContainer maxWidth="sm" className="flex items-center justify-center">
      <TabletCard className="w-full">
        <TabletCardHeader>
          <TabletCardTitle>Connect {clientName} to Cosmique</TabletCardTitle>
          <TabletCardDescription>
            This lets {clientName} use this app's tools while you are signed in. It does not bypass this app's permissions or backend policies.
          </TabletCardDescription>
        </TabletCardHeader>
        <TabletCardContent className="space-y-3">
          {details.client?.redirect_uri && (
            <p className="text-sm text-muted-foreground break-all">
              Redirect: {details.client.redirect_uri}
            </p>
          )}
          <div className="flex gap-3 pt-4">
            <TabletButton disabled={busy} onClick={() => decide(true)} fullWidth>
              Approve
            </TabletButton>
            <TabletButton disabled={busy} variant="outline" onClick={() => decide(false)} fullWidth>
              Deny
            </TabletButton>
          </div>
        </TabletCardContent>
      </TabletCard>
    </PageContainer>
  );
}
