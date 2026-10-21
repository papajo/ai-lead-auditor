import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

type Found = {
  businessName: string;
  industry: string;
  websiteUrl: string;
  phone: string | null;
  address: string | null;
  osmId: string;
  alreadyAdded: boolean;
};

export function FindLeadsDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("accountant");
  const [results, setResults] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: categories = [] } = trpc.discovery.categories.useQuery(undefined, { enabled: open });

  const search = trpc.discovery.search.useMutation({
    onSuccess: data => {
      setResults(data);
      setSelected(new Set(data.filter(d => !d.alreadyAdded).map(d => d.osmId)));
      if (data.length === 0) toast.info("No businesses with a website found there. Try a nearby city or another category.");
    },
    onError: e => toast.error(`Search failed: ${e.message}`),
  });

  const importLeads = trpc.discovery.importLeads.useMutation({
    onSuccess: r => {
      toast.success(`Imported ${r.imported} lead(s)`);
      setOpen(false);
      setResults([]);
      onImported();
    },
    onError: e => toast.error(`Import failed: ${e.message}`),
  });

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const chosen = results.filter(r => selected.has(r.osmId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="ml-2">
          <Search className="w-4 h-4 mr-2" />
          Find Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find local businesses</DialogTitle>
          <DialogDescription>
            Free search of OpenStreetMap for businesses that list a website. Data © OpenStreetMap contributors (ODbL).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-3 items-end">
          <div>
            <Label htmlFor="area">City or area</Label>
            <Input id="area" placeholder="e.g. Tampa, FL" value={area} onChange={e => setArea(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => search.mutate({ area, category, limit: 25 })}
            disabled={area.trim().length < 2 || search.isPending}
          >
            {search.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {results.length > 0 && (
          <>
            <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
              {results.map(r => (
                <label key={r.osmId} className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                  <Checkbox
                    checked={selected.has(r.osmId)}
                    disabled={r.alreadyAdded}
                    onCheckedChange={() => toggle(r.osmId)}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">
                      {r.businessName}
                      {r.alreadyAdded && <span className="ml-2 text-xs text-slate-500">(already added)</span>}
                    </div>
                    <div className="text-sm text-blue-600 truncate">{r.websiteUrl}</div>
                    {(r.address || r.phone) && (
                      <div className="text-xs text-slate-500">{[r.address, r.phone].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={chosen.length === 0 || importLeads.isPending}
              onClick={() =>
                importLeads.mutate({
                  leads: chosen.map(({ businessName, industry, websiteUrl }) => ({ businessName, industry, websiteUrl })),
                })
              }
            >
              {importLeads.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${chosen.length} lead(s)`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
