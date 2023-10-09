package br.com.wsoubar.jubarte.repository;

import org.springframework.data.jpa.repository.JpaRepository;
//import org.springframework.data.repository.CrudRepository;

import br.com.wsoubar.jubarte.model.Usuario;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
//public interface UsuarioRepository extends CrudRepository<Usuario, Long> {
    
}
