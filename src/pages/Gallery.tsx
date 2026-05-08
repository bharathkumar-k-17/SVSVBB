import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFestival } from '../contexts/FestivalContext';
import { Image, Upload, Trash2 } from 'lucide-react';

interface GalleryImage {
    id?: string;
    yearId: string;
    url: string;
    name: string;
    createdAt: string;
}

export const Gallery = () => {
    const { role } = useAuth();
    const { activeYear } = useFestival();
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const canUpload = role === 'ADMIN' || role === 'SUPER_ADMIN';

    const fetchImages = async () => {
        if (!activeYear) return;
        try {
            const q = query(collection(db, 'gallery'), where('yearId', '==', activeYear.id));
            const snapshot = await getDocs(q);
            const data: GalleryImage[] = [];
            snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as GalleryImage));
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setImages(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchImages(); }, [activeYear]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeYear || !canUpload) return;
        if (file.type.startsWith('video/')) {
            alert('Video uploads are not allowed as per rules. Please upload images only.');
            return;
        }

        setUploading(true);
        try {
            const storageRef = ref(storage, `gallery/${activeYear.id}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, 'gallery'), {
                yearId: activeYear.id,
                url: downloadURL,
                name: file.name,
                createdAt: new Date().toISOString()
            });
            fetchImages();
        } catch (error) {
            console.error(error);
            alert('Upload failed');
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    if (!activeYear) return <div style={{ padding: '2rem' }}>No active year</div>;

    return (
        <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', color: 'var(--saffron-700)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Image size={28} /> Festival Image Gallery
            </h1>

            {canUpload && (
                <div className="card" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', borderStyle: 'dashed', borderWidth: '2px', borderColor: 'var(--saffron-400)', background: 'var(--saffron-50)' }}>
                    <Upload size={48} color="var(--saffron-600)" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--saffron-700)' }}>Upload Images</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Upload high-quality JPEG/PNG files for {activeYear.id}. No videos allowed.</p>

                    <label className="btn btn-primary" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                        {uploading ? 'Uploading...' : 'Select File'}
                    </label>
                </div>
            )}

            <div className="grid-cols-3" style={{ gap: '1rem' }}>
                {images.map(img => (
                    <div key={img.id} className="fade-in" style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '1/1', boxShadow: 'var(--shadow-sm)' }}>
                        <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    </div>
                ))}
            </div>

            {!loading && images.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Image size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p>No images uploaded for {activeYear.id} yet.</p>
                </div>
            )}
        </div>
    );
};
