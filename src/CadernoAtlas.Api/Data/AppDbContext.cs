using CadernoAtlas.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CadernoAtlas.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<DemandaAcademica> DemandasAcademicas => Set<DemandaAcademica>();

    public DbSet<TarefaDemanda> TarefasDemanda => Set<TarefaDemanda>();

    public DbSet<Caderno> Cadernos => Set<Caderno>();

    public DbSet<Concurso> Concursos => Set<Concurso>();

    public DbSet<DisciplinaEdital> DisciplinasEdital => Set<DisciplinaEdital>();

    public DbSet<TopicoEdital> TopicosEdital => Set<TopicoEdital>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DemandaAcademica>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint(
                "CK_DemandasAcademicas_EsforcoNaoNegativo",
                "\"EsforcoEstimadoMinutos\" IS NULL OR \"EsforcoEstimadoMinutos\" >= 0"));

            entity.Property(x => x.Titulo)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Descricao)
                .HasMaxLength(1000);

            entity.Property(x => x.Tipo)
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.Importancia)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(x => x.Situacao)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            entity.HasIndex(x => new { x.Situacao, x.Prazo });
        });

        modelBuilder.Entity<TarefaDemanda>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint(
                "CK_TarefasDemanda_OrdemNaoNegativa",
                "\"Ordem\" >= 0"));

            entity.Property(x => x.Titulo)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Descricao)
                .HasMaxLength(1000);

            entity.Property(x => x.Situacao)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            entity.HasOne(x => x.DemandaAcademica)
                .WithMany(x => x.Tarefas)
                .HasForeignKey(x => x.DemandaAcademicaId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new
            {
                x.DemandaAcademicaId,
                x.Ordem
            });
        });

        modelBuilder.Entity<Caderno>(entity =>
        {
            entity.Property(x => x.Titulo)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Descricao)
                .HasMaxLength(1000);
        });

        modelBuilder.Entity<Concurso>(entity =>
        {
            entity.Property(x => x.Nome)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Orgao)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Banca)
                .HasMaxLength(100);

            entity.Property(x => x.NumeroEdital)
                .HasMaxLength(50);
        });

        modelBuilder.Entity<DisciplinaEdital>(entity =>
        {
            entity.Property(x => x.Nome)
                .HasMaxLength(120)
                .IsRequired();

            entity.HasOne(x => x.Concurso)
                .WithMany(x => x.Disciplinas)
                .HasForeignKey(x => x.ConcursoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.ConcursoId, x.Ordem });
        });

        modelBuilder.Entity<TopicoEdital>(entity =>
        {
            entity.Property(x => x.Descricao)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            entity.HasOne(x => x.DisciplinaEdital)
                .WithMany(x => x.Topicos)
                .HasForeignKey(x => x.DisciplinaEditalId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.TopicoPai)
                .WithMany(x => x.Subtopicos)
                .HasForeignKey(x => x.TopicoPaiId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new
            {
                x.DisciplinaEditalId,
                x.Ordem
            });
        });
    }
}