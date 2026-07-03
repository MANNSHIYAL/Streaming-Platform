using BlobUpload.Models;
using Microsoft.EntityFrameworkCore;

namespace BlobUpload.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<VideoRecord> VideoRecord { get; set; }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // MySQL specific optimization: Enums are best mapped as strings or integers.
            // This ensures VideoStatus saves cleanly.
            modelBuilder.Entity<VideoRecord>()
               .HasKey(v => v.Id);

            modelBuilder.Entity<VideoRecord>()
                .Property(v => v.Id)
                .ValueGeneratedNever();
            
            modelBuilder.Entity<VideoRecord>()
                .Property(v => v.Status)
                .HasConversion<string>()
                .HasMaxLength(50);
        }
    }
}
