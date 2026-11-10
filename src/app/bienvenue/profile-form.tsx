"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProfileAction, type ProfileState } from "./actions";

export function ProfileForm({ inviteCode }: { inviteCode: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(createProfileAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="inviteCode">Code d&apos;invitation</Label>
        <Input id="inviteCode" name="inviteCode" defaultValue={inviteCode} autoCapitalize="characters" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="firstName">Prénom</Label>
        <Input id="firstName" name="firstName" maxLength={40} autoComplete="given-name" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">Pseudo</Label>
        <Input id="nickname" name="nickname" minLength={2} maxLength={24} required />
      </div>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending}>
        C&apos;est parti
      </Button>
    </form>
  );
}
