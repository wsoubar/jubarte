package br.com.wsoubar.jubarte.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import br.com.wsoubar.jubarte.model.Usuario;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    
}
