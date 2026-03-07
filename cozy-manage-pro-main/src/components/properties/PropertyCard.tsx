import { Property } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Wrench, FileText, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';

interface PropertyCardProps {
  property: Property;
  onSelect?: (property: Property) => void;
}

const statusLabels = {
  occupied: 'מושכר',
  vacant: 'פנוי',
  preparing: 'בהכנה',
};

export function PropertyCard({ property, onSelect }: PropertyCardProps) {
  // Generate signed URL for private storage images
  const signedImageUrl = useSignedImageUrl(property.image, 'property-images');

  return (
    <Card hover className="overflow-hidden animate-fade-in">
      {signedImageUrl && (
        <div className="relative h-40 overflow-hidden">
          <img 
            src={signedImageUrl} 
            alt={property.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3">
            <Badge variant={property.status}>{statusLabels[property.status]}</Badge>
          </div>
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground line-clamp-1">{property.name}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {property.address}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          <Link to="/owner/arrivals">
            <Button variant="quickAction" size="sm" className="flex-col h-auto py-2 px-1 w-full">
              <Calendar className="w-4 h-4 mb-1" />
              <span className="text-[10px]">לוח שנה</span>
            </Button>
          </Link>
          <Link to="/owner/services">
            <Button variant="quickAction" size="sm" className="flex-col h-auto py-2 px-1 w-full">
              <Wrench className="w-4 h-4 mb-1" />
              <span className="text-[10px]">שירותים</span>
            </Button>
          </Link>
          <Link to="/owner/issues">
            <Button variant="quickAction" size="sm" className="flex-col h-auto py-2 px-1 w-full">
              <FileText className="w-4 h-4 mb-1" />
              <span className="text-[10px]">תקלות</span>
            </Button>
          </Link>
          <Button variant="quickAction" size="sm" className="flex-col h-auto py-2 px-1" onClick={() => onSelect?.(property)}>
            <Info className="w-4 h-4 mb-1" />
            <span className="text-[10px]">פרטים</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
