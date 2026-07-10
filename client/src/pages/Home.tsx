"use client";

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    businessName: "",
    industry: "",
    websiteUrl: "",
    googleRating: "",
    googleReviews: "",
  });

  // Fetch leads
  const { data: leads = [], isLoading, refetch } = trpc.leads.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Create lead mutation
  const createLeadMutation = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead created successfully!");
      setFormData({ businessName: "", industry: "", websiteUrl: "", googleRating: "", googleReviews: "" });
      setIsOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead deleted successfully!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleCreateLead = async () => {
    if (!formData.businessName || !formData.industry || !formData.websiteUrl) {
      toast.error("Please fill in all required fields");
      return;
    }

    await createLeadMutation.mutateAsync({
      businessName: formData.businessName,
      industry: formData.industry,
      websiteUrl: formData.websiteUrl,
      googleRating: formData.googleRating || null,
      googleReviews: formData.googleReviews ? parseInt(formData.googleReviews) : null,
    });
  };

  const handleDeleteLead = async (leadId: number) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      await deleteLeadMutation.mutateAsync({ leadId });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      "New": "bg-blue-100 text-blue-800",
      "Contacted": "bg-yellow-100 text-yellow-800",
      "Responded": "bg-purple-100 text-purple-800",
      "Converted": "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-slate-900">AI Lead Auditor</CardTitle>
            <CardDescription className="text-base mt-2">
              Analyze websites and generate personalized outreach messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-center">
              Sign in to start managing your business leads and generating outreach campaigns.
            </p>
            <Button
              onClick={() => startLogin()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6"
            >
              Sign In with Manus
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">AI Lead Auditor</h1>
          <p className="text-slate-600">Welcome, {user?.name}. Manage and analyze your business leads efficiently.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{leads.length}</div>
                <p className="text-sm text-slate-600 mt-1">Total Leads</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{leads.filter(l => l.status === "Converted").length}</div>
                <p className="text-sm text-slate-600 mt-1">Converted</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {leads.length > 0 ? Math.round((leads.filter(l => l.status === "Converted").length / leads.length) * 100) : 0}%
                </div>
                <p className="text-sm text-slate-600 mt-1">Conversion Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Lead Button */}
        <div className="mb-6">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add New Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>Enter the business information to add a new lead</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    placeholder="e.g., Acme Corp"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry *</Label>
                  <Input
                    id="industry"
                    placeholder="e.g., Technology"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="websiteUrl">Website URL *</Label>
                  <Input
                    id="websiteUrl"
                    placeholder="https://example.com"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="googleRating">Google Rating</Label>
                  <Input
                    id="googleRating"
                    placeholder="e.g., 4.5"
                    value={formData.googleRating}
                    onChange={(e) => setFormData({ ...formData, googleRating: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="googleReviews">Google Reviews</Label>
                  <Input
                    id="googleReviews"
                    placeholder="e.g., 120"
                    type="number"
                    value={formData.googleReviews}
                    onChange={(e) => setFormData({ ...formData, googleReviews: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleCreateLead}
                  disabled={createLeadMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {createLeadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Lead
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Leads Table */}
        <Card className="bg-white shadow-lg border-0">
          <CardHeader>
            <CardTitle>Your Leads</CardTitle>
            <CardDescription>Manage all your business leads in one place</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : leads.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Business Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Industry</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Rating</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Status</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id} className="border-slate-100 hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">{lead.businessName}</TableCell>
                        <TableCell className="text-slate-600">{lead.industry}</TableCell>
                        <TableCell className="text-slate-600">
                          {lead.googleRating ? `${lead.googleRating}⭐` : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(lead.status)}>{lead.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteLead(lead.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No leads yet. Create your first lead to get started!</p>
                <Button
                  onClick={() => setIsOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Lead
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
