import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  email: string;
  githubUrl: string;
  linkedinUrl: string;
};

export function ContactCTA({ email, githubUrl, linkedinUrl }: Props) {
  return (
    <Card className="border-white/10 bg-white/5 p-8 text-center backdrop-blur">
      <h3 className="text-2xl font-semibold">Let’s Connect</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">
        I’m looking for cloud roles and I love building production-style AWS projects.
        Reach out for opportunities, collaborations, or code reviews.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-white/10 text-slate-100 hover:bg-white/15">
          <Link href={`mailto:${email}`}>Email</Link>
        </Button>

        <Button asChild variant="outline" className="border-white/10 bg-white/5">
          <Link href={githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </Link>
        </Button>

        <Button asChild variant="outline" className="border-white/10 bg-white/5">
          <Link href={linkedinUrl} target="_blank" rel="noreferrer">
            LinkedIn
          </Link>
        </Button>
      </div>
    </Card>
  );
}
