"use client";
import { useEffect, useState, type FormEvent } from "react";
import { profileFieldsSchema } from "@/lib/schemas";
import { useWorkspace } from "../workspace/workspace-provider";
import { PageHeading } from "../ui/page-heading";
import { CardHeader } from "../ui/card-header";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
export function AboutForm() {
  const { profile, saveProfile } = useWorkspace();
  const [fields, setFields] = useState({
    companyName: profile.companyName,
    memberName: profile.memberName,
    about: profile.about,
  });
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setFields({
      companyName: profile.companyName,
      memberName: profile.memberName,
      about: profile.about,
    });
  }, [profile]);
  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = profileFieldsSchema.safeParse(fields);
    if (!parsed.success)
      return setError(
        parsed.error.issues[0]?.message ?? "Check the profile fields.",
      );
    setSaving(true);
    setError("");
    try {
      await saveProfile(parsed.data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The profile could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Tell your story. Once."
        subtitle="AI uses the relevant parts of your saved company profile in every proposal."
      />
      <section className="card">
        <CardHeader
          title="About us"
          subtitle={`Written by ${profile.memberName}. Used by AI across your proposals.`}
          label="COMPANY PROFILE"
        />
        <form id="about-form" onSubmit={save}>
          <div className="card-body">
            <div className="two-col">
              <div className="field">
                <label htmlFor="company-name">Company name</label>
                <input
                  id="company-name"
                  maxLength={120}
                  required
                  value={fields.companyName}
                  onChange={(event) =>
                    setFields({ ...fields, companyName: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="member-name">Represented member</label>
                <input
                  id="member-name"
                  maxLength={120}
                  required
                  value={fields.memberName}
                  onChange={(event) =>
                    setFields({ ...fields, memberName: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="company-about">About us</label>
              <textarea
                id="company-about"
                maxLength={20_000}
                className="about-editor"
                value={fields.about}
                onChange={(event) =>
                  setFields({ ...fields, about: event.target.value })
                }
                placeholder={
                  "Describe NordStone in your own words.\n\nWhat services do you offer? Which tools and technologies do you work with? What real experience and results can you share?"
                }
              />
              <div className="word-count">
                {fields.about.length.toLocaleString()} / 20,000 characters
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="card-actions">
            <Button type="submit" disabled={saving}>
              <Icon name="check" />
              {saving ? "Saving…" : "Save About us"}
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}
